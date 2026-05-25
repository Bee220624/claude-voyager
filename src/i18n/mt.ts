import { TEXT_DICT, EXACT_WORDS, PATTERN_REPLACEMENTS } from './zh-CN';

// 端上机器翻译兜底（Machine Translation fallback）。
//
// 思路：字典没覆盖的英文 UI 文字 → 交给 Chrome 自带的 Translator API（在 bridge.js / MAIN world 里跑）
// → 翻译结果缓存到 chrome.storage.local["voyager.i18nCache"] → 之后由 translator 的字典路径一并应用。
//
// 安全红线：只采集 **UI chrome**（按钮/菜单/标签/标题 + aria-label 等属性），
// 绝不把对话正文 / 代码 / 我们自己的 UI 送去翻译。
//
// 缓存即「自动生长的数据集」：用 __voyager.exportCache() 导出，挑好的折叠进内置字典发新版。

const CACHE_KEY = 'voyager.i18nCache';

let cache: Record<string, string> = {};
let cacheLoaded = false;
let enabled = false;
let mtUnavailable = false; // bridge 报告端上翻译不可用后置位，停止再扫
let onCacheUpdated: (() => void) | null = null;

const requested = new Set<string>(); // 已发过翻译请求的（无论成败），避免重复发
let scanTimer: number | null = null;

// ---- 跨 world 请求（结果由 bridge.js 通过 voyager:mt-response 回传）----
type MtResponse = { result: Record<string, string>; available: boolean; reason?: string };
let reqId = 0;
const pending = new Map<number, (r: MtResponse) => void>();

document.addEventListener('voyager:mt-response', (e: Event) => {
  const detail = (
    e as CustomEvent<{ id: number; result: Record<string, string>; available: boolean; reason?: string }>
  ).detail;
  const resolve = pending.get(detail.id);
  if (resolve) {
    pending.delete(detail.id);
    resolve({ result: detail.result ?? {}, available: detail.available !== false, reason: detail.reason });
  }
});

function requestTranslate(strings: string[]): Promise<MtResponse> {
  return new Promise((resolve) => {
    const id = ++reqId;
    pending.set(id, resolve);
    document.dispatchEvent(new CustomEvent('voyager:mt-request', { detail: { id, strings } }));
    // 超时兜底（当作可重试，不永久禁用）
    window.setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        resolve({ result: {}, available: false, reason: 'retry' });
      }
    }, 20000);
  });
}

// ---- 缓存 ----
async function loadCache(): Promise<void> {
  const d = await chrome.storage.local.get(CACHE_KEY);
  cache = (d[CACHE_KEY] as Record<string, string> | undefined) ?? {};
  cacheLoaded = true;
}

async function mergeIntoCache(entries: Record<string, string>): Promise<void> {
  Object.assign(cache, entries);
  await chrome.storage.local.set({ [CACHE_KEY]: cache });
}

/** translator 的第 4 级查询：命中缓存返回中文。 */
export function mtLookup(trimmed: string): string | undefined {
  return cache[trimmed];
}

export function getCacheSnapshot(): Record<string, string> {
  return { ...cache };
}

export function getMtStatus(): { enabled: boolean; unavailable: boolean; cached: number } {
  return { enabled, unavailable: mtUnavailable, cached: Object.keys(cache).length };
}

// ---- 候选 UI 文字采集（与 harvest 同口径，但这里用于喂 MT）----
function isCovered(t: string): boolean {
  if (TEXT_DICT[t] || EXACT_WORDS[t] || cache[t]) return true;
  return PATTERN_REPLACEMENTS.some(({ match }) => match.test(t));
}

function looksTranslatable(raw: string): boolean {
  const t = raw.trim();
  if (t.length < 2 || t.length > 80) return false; // 单字符不翻，过长多半是正文
  if (!/[a-zA-Z]/.test(t)) return false;
  if (/^[\d\s.,:;%$+\-/()|]+$/.test(t)) return false;
  const han = (t.match(/[一-鿿]/g) ?? []).length;
  if (han > 0 && han / t.length > 0.3) return false;
  if (/^https?:\/\//.test(t) || /\S+@\S+\.\S+/.test(t)) return false;
  return true;
}

const EXCLUDE_ZONE =
  '[data-voyager-ui], [data-voyager-skip-i18n], code, pre, ' +
  '[data-testid="user-message"], [data-testid*="message" i], ' +
  '[class*="font-claude" i], [class*="font-user" i]';

const CONTROL_SEL =
  'button, [role="button"], [role="menuitem"], [role="tab"], [role="option"], ' +
  'label, summary, h1, h2, h3, h4, h5, h6, [role="heading"], option';

function collectCandidates(): string[] {
  const found = new Set<string>();
  const add = (raw: string | null | undefined) => {
    if (!raw) return;
    const t = raw.trim();
    if (looksTranslatable(t) && !isCovered(t) && !requested.has(t)) found.add(t);
  };

  document.querySelectorAll<HTMLElement>(CONTROL_SEL).forEach((el) => {
    if (el.closest(EXCLUDE_ZONE)) return;
    let own = '';
    for (const n of Array.from(el.childNodes)) {
      if (n.nodeType === Node.TEXT_NODE) own += n.nodeValue ?? '';
    }
    add(own);
    if (!own.trim()) {
      const whole = (el.textContent ?? '').trim();
      if (whole.length <= 32) add(whole);
    }
  });

  // 属性（aria-label / placeholder / title）—— 几乎一定是 UI 文字
  document
    .querySelectorAll<HTMLElement>('[aria-label], [placeholder], [title]')
    .forEach((el) => {
      if (el.closest(EXCLUDE_ZONE)) return;
      add(el.getAttribute('aria-label'));
      add(el.getAttribute('placeholder'));
      add(el.getAttribute('title'));
    });

  // 链接：跳过对话/项目标题（用户内容），其余 UI 链接文字可翻
  document.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((a) => {
    const href = a.getAttribute('href') ?? '';
    if (/^\/(chat|project)/i.test(href)) return;
    if (a.closest(EXCLUDE_ZONE)) return;
    let own = '';
    for (const n of Array.from(a.childNodes)) {
      if (n.nodeType === Node.TEXT_NODE) own += n.nodeValue ?? '';
    }
    add(own);
  });

  return Array.from(found);
}

// ---- 编排：扫描 → 翻译 → 缓存 → 触发 translator 重扫 ----
export function scheduleScan(): void {
  if (!enabled || mtUnavailable) return;
  if (scanTimer !== null) return;
  scanTimer = window.setTimeout(() => {
    scanTimer = null;
    void scan();
  }, 1000);
}

async function scan(): Promise<void> {
  if (!enabled || mtUnavailable) return;
  const candidates = collectCandidates();
  if (candidates.length === 0) return;

  const batch = candidates.slice(0, 60); // 一批最多 60 条，避免一次性压垮
  batch.forEach((s) => requested.add(s));

  const { result, available, reason } = await requestTranslate(batch);
  if (!available) {
    // 失败的这批从 requested 移除，允许之后重试
    batch.forEach((s) => requested.delete(s));
    if (reason === 'unsupported') {
      // 真不支持（Chrome < 138 / 非桌面）→ 永久停用，不再扫
      mtUnavailable = true;
      console.info('[Voyager] 端上翻译不可用（需 Chrome 138+ 桌面版）；仅用字典。');
    }
    // reason==='retry'（多半是首次需用户手势 / 模型下载中）→ 不禁用，
    // 等用户点一下页面（bridge 的 pointerdown 预热）+ 下次 DOM 变化时自然重试
    return;
  }

  const good: Record<string, string> = {};
  for (const [en, zh] of Object.entries(result)) {
    const z = (zh ?? '').trim();
    if (z && z !== en && /[一-鿿]/.test(z)) good[en] = z; // 必须真的翻成了含中文的结果
  }
  if (Object.keys(good).length > 0) {
    await mergeIntoCache(good);
    onCacheUpdated?.(); // 让 translator 重扫，把新译文应用上去
  }

  // 还有候选没翻完（>60）→ 再排一轮
  if (candidates.length > batch.length) scheduleScan();
}

export async function startMT(onUpdated: () => void): Promise<void> {
  onCacheUpdated = onUpdated;
  if (!cacheLoaded) await loadCache();
  enabled = true;
  scheduleScan();
}

export function stopMT(): void {
  enabled = false;
  if (scanTimer !== null) {
    clearTimeout(scanTimer);
    scanTimer = null;
  }
}

export function isMtEnabled(): boolean {
  return enabled;
}
