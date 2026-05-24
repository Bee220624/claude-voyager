// 检测 Claude 对话页面里的用户消息。
//
// Claude 的 DOM 没有完全稳定的约定，所以这里用多个兜底选择器，按优先级匹配，
// 第一个能命中元素的选择器即作为本次会话的「主选择器」。
// 如果以后 Claude 更新了 DOM，往 USER_SELECTORS 顶部加新选择器即可。

export const USER_SELECTORS: readonly string[] = [
  '[data-testid="user-message"]',
  '[data-testid*="user-message" i]',
  '[data-testid*="user" i][data-testid*="message" i]',
  '[data-test-render-count][class*="font-user"]',
  '.font-user-message',
  'div[class*="font-user-message"]',
  'div[class*="font-user" i]',
  '[class*="userMessage" i]',
];

export interface UserMessage {
  /** 用户消息根元素 */
  el: HTMLElement;
  /** 第几条（从 1 开始） */
  index: number;
  /** 截断后的预览（不超过 60 字符），用于节点内联显示 */
  preview: string;
  /** 完整消息文本（已规整空白），用于悬停 tooltip —— 前缀撞车时靠它区分 */
  fullText: string;
  /** 用于在标星/书签里识别同一条消息的稳定 hash */
  hash: string;
}

const PREVIEW_LIMIT = 60;

function truncate(text: string, limit = PREVIEW_LIMIT): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= limit) return t;
  return t.slice(0, limit - 1) + '…';
}

// FNV-1a 32-bit；够短够稳，不依赖加密 API（content script 无需高安全）。
function hashText(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export function findUserMessageElements(root: ParentNode = document): HTMLElement[] {
  for (const sel of USER_SELECTORS) {
    const found = Array.from(root.querySelectorAll<HTMLElement>(sel));
    if (found.length > 0) return found;
  }
  return [];
}

/**
 * 抽取用户消息文本。多级兜底，保证非空时尽量返回有意义的内容：
 *  1) 克隆后删按钮/svg/我们自己的 UI（不删 aria-hidden，避免误删被标注的正文），取 textContent
 *  2) 退回原始 textContent
 *  3) 退回 innerText
 * 注意：不要删 [aria-hidden]，Claude 有时把正文容器标 aria-hidden 做无障碍处理。
 */
export function extractCleanText(el: HTMLElement): string {
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

  const clone = el.cloneNode(true) as HTMLElement;
  clone
    .querySelectorAll('button, [role="button"], svg, [data-voyager-ui]')
    .forEach((n) => n.remove());
  let text = norm(clone.textContent ?? '');
  if (text) return text;

  text = norm(el.textContent ?? '');
  if (text) return text;

  text = norm(el.innerText ?? '');
  return text;
}

export function collectUserMessages(): UserMessage[] {
  const els = findUserMessageElements();
  return els.map((el, i) => {
    const text = extractCleanText(el);
    return {
      el,
      index: i + 1,
      preview: truncate(text),
      fullText: text,
      hash: hashText(text || String(i + 1)),
    };
  });
}

/**
 * 找到承载消息流的滚动容器。
 * 优先返回正在滚动 (overflow:auto/scroll) 的最深祖先；找不到时回退到 document.scrollingElement。
 */
export function findScrollContainer(forElement?: HTMLElement): HTMLElement {
  const seed = forElement ?? findUserMessageElements()[0];
  if (seed) {
    let cur: HTMLElement | null = seed.parentElement;
    while (cur && cur !== document.body) {
      const style = getComputedStyle(cur);
      if (/(auto|scroll|overlay)/.test(style.overflowY) && cur.scrollHeight > cur.clientHeight) {
        return cur;
      }
      cur = cur.parentElement;
    }
  }
  return (document.scrollingElement as HTMLElement) ?? document.documentElement;
}
