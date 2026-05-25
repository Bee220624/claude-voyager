import { TEXT_DICT, EXACT_WORDS, PATTERN_REPLACEMENTS } from './zh-CN';
import { mtLookup, startMT, stopMT, scheduleScan as scheduleMtScan, isMtEnabled } from './mt';

// 已翻译节点：避免反复处理同一节点（也用来在关闭时还原）。
const ORIGINAL_TEXT = new WeakMap<Text, string>();
const ORIGINAL_ATTR = new WeakMap<Element, Map<string, string>>();

const TRANSLATABLE_ATTRS = ['aria-label', 'placeholder', 'title', 'alt'];

let observer: MutationObserver | null = null;
let enabled = false;
let rewalkTimer: number | null = null;

/**
 * 防抖全量重扫安全网。
 * observer 的「逐个新增节点翻译」可能漏掉异步填充的内容（典型：设置页 React 懒填充），
 * 或被 React 重渲刷回英文。这里在 DOM 活动后 600ms 整页重扫一次兜底。
 * 用「首次触发后 600ms 才扫、扫完再解锁」的节流：连续 mutation（如流式输出）期间最多每 600ms 扫一次。
 */
function scheduleRewalk(): void {
  if (rewalkTimer !== null) return;
  rewalkTimer = window.setTimeout(() => {
    rewalkTimer = null;
    if (enabled) walk(document.body);
  }, 600);
}

function translateString(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (TEXT_DICT[trimmed]) return raw.replace(trimmed, TEXT_DICT[trimmed]);
  if (EXACT_WORDS[trimmed]) return raw.replace(trimmed, EXACT_WORDS[trimmed]);
  for (const { match, replace } of PATTERN_REPLACEMENTS) {
    if (match.test(trimmed)) {
      const translated = trimmed.replace(match, replace);
      if (translated !== trimmed) return raw.replace(trimmed, translated);
    }
  }
  // 第 4 级：端上翻译缓存（字典没有时才命中）
  const mt = mtLookup(trimmed);
  if (mt && mt !== trimmed) return raw.replace(trimmed, mt);
  return null;
}

function translateTextNode(node: Text): void {
  if (!node.parentElement) return;
  const tag = node.parentElement.tagName;
  // 跳过代码块、脚本和我们自己注入的 UI。
  if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'CODE' || tag === 'PRE') return;
  // 合并两个跳过判断为一次 closest 调用（这函数会被高频调用，省一点是一点）
  if (node.parentElement.closest('[data-voyager-ui], [data-voyager-skip-i18n]')) return;

  const original = node.nodeValue ?? '';
  const translated = translateString(original);
  if (!translated || translated === original) return;

  if (!ORIGINAL_TEXT.has(node)) ORIGINAL_TEXT.set(node, original);
  node.nodeValue = translated;
}

function translateAttributes(el: Element): void {
  for (const attr of TRANSLATABLE_ATTRS) {
    const value = el.getAttribute(attr);
    if (!value) continue;
    const translated = translateString(value);
    if (!translated || translated === value) continue;
    let saved = ORIGINAL_ATTR.get(el);
    if (!saved) {
      saved = new Map();
      ORIGINAL_ATTR.set(el, saved);
    }
    if (!saved.has(attr)) saved.set(attr, value);
    el.setAttribute(attr, translated);
  }
}

function walk(root: Node): void {
  if (root.nodeType === Node.TEXT_NODE) {
    translateTextNode(root as Text);
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  const el = root as Element;
  translateAttributes(el);
  // TreeWalker 一次扫完文本节点 + 后续元素的属性
  const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let current: Node | null = tw.currentNode;
  while (current) {
    if (current === el) {
      current = tw.nextNode();
      continue;
    }
    if (current.nodeType === Node.TEXT_NODE) translateTextNode(current as Text);
    else if (current.nodeType === Node.ELEMENT_NODE) translateAttributes(current as Element);
    current = tw.nextNode();
  }
}

function restoreAll(): void {
  // 文本节点 / 属性的还原依赖 WeakMap 里保存的原值。
  // WeakMap 不支持遍历，所以我们用 querySelectorAll 拿到所有有原值的节点。
  // —— 简化：还原阶段直接重新扫描页面，把那些「等于翻译结果」的文本/属性还原回 dict 的 key。
  // 这里换一个更稳妥的实现：对当前页面所有 text node / element 跑一遍反查。
  const reverse: Record<string, string> = {};
  for (const [k, v] of Object.entries(TEXT_DICT)) reverse[v] = k;
  for (const [k, v] of Object.entries(EXACT_WORDS)) reverse[v] = k;

  const tw = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
  );
  let current: Node | null = tw.currentNode;
  while (current) {
    if (current === document.body) {
      current = tw.nextNode();
      continue;
    }
    if (current.nodeType === Node.TEXT_NODE) {
      const text = current as Text;
      if (text.parentElement?.closest('[data-voyager-ui]')) {
        current = tw.nextNode();
        continue;
      }
      const trimmed = (text.nodeValue ?? '').trim();
      if (trimmed && reverse[trimmed]) {
        text.nodeValue = (text.nodeValue ?? '').replace(trimmed, reverse[trimmed]);
      }
    } else if (current.nodeType === Node.ELEMENT_NODE) {
      const el = current as Element;
      for (const attr of TRANSLATABLE_ATTRS) {
        const value = el.getAttribute(attr);
        if (value && reverse[value.trim()]) {
          el.setAttribute(attr, value.replace(value.trim(), reverse[value.trim()]));
        }
      }
    }
    current = tw.nextNode();
  }
}

/** translator 重扫整页（供 MT 缓存更新后调用，把新译文应用上去）。 */
function rewalkNow(): void {
  if (enabled) walk(document.body);
}

/** 运行时开关 MT 兜底（不影响字典翻译）。 */
export function setMtFallback(on: boolean): void {
  if (on && !isMtEnabled()) {
    void startMT(rewalkNow);
  } else if (!on && isMtEnabled()) {
    stopMT();
  }
}

export function enableI18n(mtFallback = false): void {
  if (enabled) {
    setMtFallback(mtFallback);
    return;
  }
  enabled = true;

  walk(document.body);
  setMtFallback(mtFallback);

  observer = new MutationObserver((records) => {
    for (const rec of records) {
      if (rec.type === 'childList') {
        rec.addedNodes.forEach((n) => walk(n));
      } else if (rec.type === 'characterData') {
        if (rec.target.nodeType === Node.TEXT_NODE) translateTextNode(rec.target as Text);
      } else if (rec.type === 'attributes') {
        if (rec.target.nodeType === Node.ELEMENT_NODE) translateAttributes(rec.target as Element);
      }
    }
    // 兜底：DOM 活动后 600ms 整页重扫（设置页等异步内容靠这个补上）
    scheduleRewalk();
    // 让 MT 兜底也扫一遍新出现的 UI 文字
    if (isMtEnabled()) scheduleMtScan();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: TRANSLATABLE_ATTRS,
  });
}

export function disableI18n(): void {
  if (!enabled) return;
  enabled = false;
  stopMT();
  observer?.disconnect();
  observer = null;
  if (rewalkTimer !== null) {
    clearTimeout(rewalkTimer);
    rewalkTimer = null;
  }
  restoreAll();
}

export function isI18nEnabled(): boolean {
  return enabled;
}
