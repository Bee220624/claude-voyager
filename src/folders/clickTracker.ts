// 跟踪「用户最近点击的对话」：当 Claude 三点菜单弹出时，我们没法直接
// 从菜单元素反推它属于哪条对话，所以提前在 capture 阶段记一份。
//
// 选择捕获阶段是因为 Claude 的菜单按钮点击后会立刻 stopPropagation 弹菜单。
// 我们在 capture 上抢先记，比冒泡阶段稳。

export interface TrackedChat {
  url: string;
  title: string;
  /** 触发记录的时间戳，用于过期判断（菜单超过几秒未出现就作废） */
  at: number;
}

const FRESHNESS_MS = 4000;
let last: TrackedChat | null = null;

/** 给定任意点击目标，沿着 DOM 往上找最近的 chat link，返回它的 (url, title)。 */
function findChatFor(target: HTMLElement): TrackedChat | null {
  // 直接命中
  const direct = target.closest<HTMLAnchorElement>('a[href^="/chat/"]');
  if (direct) {
    return { url: direct.pathname, title: extractTitle(direct), at: Date.now() };
  }
  // 三点按钮 / 操作按钮往往是 chat link 的兄弟节点。
  // 往上找 list item（li / [role=listitem] / 含 a[href^="/chat/"] 的最近祖先）。
  const row =
    target.closest<HTMLElement>('li, [role="listitem"]') ??
    (target.closest<HTMLElement>('[class]')?.parentElement ?? null);
  if (row) {
    const a = row.querySelector<HTMLAnchorElement>('a[href^="/chat/"]');
    if (a) return { url: a.pathname, title: extractTitle(a), at: Date.now() };
  }
  return null;
}

function extractTitle(a: HTMLAnchorElement): string {
  // 优先 aria-label / title，再退回 textContent
  const aria = a.getAttribute('aria-label');
  if (aria) return aria.trim();
  const t = a.getAttribute('title');
  if (t) return t.trim();
  return (a.textContent ?? '').trim() || '未命名对话';
}

function onCaptureClick(e: Event): void {
  const target = e.target as HTMLElement | null;
  if (!target) return;
  const found = findChatFor(target);
  if (found) last = found;
}

let attached = false;
export function startClickTracking(): void {
  if (attached) return;
  document.addEventListener('click', onCaptureClick, true);
  document.addEventListener('contextmenu', onCaptureClick, true);
  attached = true;
}

export function stopClickTracking(): void {
  if (!attached) return;
  document.removeEventListener('click', onCaptureClick, true);
  document.removeEventListener('contextmenu', onCaptureClick, true);
  attached = false;
}

/** 取得最近点击的 chat，新鲜（FRESHNESS_MS 内）才返回。 */
export function getLastClickedChat(): TrackedChat | null {
  if (!last) return null;
  if (Date.now() - last.at > FRESHNESS_MS) return null;
  return last;
}

export function clearLastClickedChat(): void {
  last = null;
}

/** 如果当前正在 chat 页面，直接构造一份；用于「Header 上的全局菜单」场景。 */
export function getCurrentChatAsFallback(): TrackedChat | null {
  const path = location.pathname;
  if (!/^\/chat\/[0-9a-f-]+/i.test(path)) return null;
  const heading = document.querySelector('main h1, header h1, [class*="conversation-header"] h1');
  const title =
    heading?.textContent?.trim() ||
    document.title.replace(/\s*[-|·]\s*Claude\s*$/i, '').trim() ||
    '未命名对话';
  return { url: path, title, at: Date.now() };
}
