import { getLastClickedChat, getCurrentChatAsFallback, clearLastClickedChat } from './clickTracker';
import { showFolderPicker } from './pickerDialog';

// 监听全局 DOM，找到 Claude 弹出的对话上下文菜单后注入「加入文件夹」按钮。
//
// Claude 用 React 把菜单 render 到 body 下的 portal 里。
// 不同版本的 DOM 类名都不稳定，所以靠以下特征判断「这是不是一个对话菜单」：
//   1) 元素本身或子节点是 `[role="menu"]` 容器
//   2) 容器内能找到典型的对话操作（Delete chat / Rename / Star / Share，或其中文翻译）
//
// 找到目标菜单后：
//   - 选一个现有 menuitem 作模板，克隆并改文字 / role / 不带原 click handler，
//     这样视觉上和 Claude 自己的项完全一致。
//   - 拿 getLastClickedChat() 得到「这是哪条对话」，没有就回退到当前页面 URL。

const INJECTED_MARKER = 'data-voyager-menuitem';
const LABEL = '加入文件夹';

const CHAT_MENU_KEYWORDS = [
  // 英文原文
  /^Delete chat$/i,
  /^Delete conversation$/i,
  /^Delete$/i,
  /^Rename$/i,
  /^Rename chat$/i,
  /^Share$/i,
  /^Share chat$/i,
  /^Star$/i,
  /^Unstar$/i,
  /^Archive$/i,
  /^Add to project$/i,
  /^Move to project$/i,
  /^Export$/i,
  // i18n 之后的中文
  /^删除$/,
  /^删除对话$/,
  /^重命名$/,
  /^重命名对话$/,
  /^分享$/,
  /^分享对话$/,
  /^收藏$/,
  /^取消收藏$/,
  /^归档$/,
  /^加入项目$/,
  /^移动到项目$/,
  /^移到项目$/,
  /^导出$/,
];

// 兜底容器选择器：role=menu 优先，其它放后面。
const MENU_CONTAINER_SELECTORS = [
  '[role="menu"]',
  '[data-radix-menu-content]',
  '[data-radix-popper-content-wrapper] [role="menu"]',
  '[data-state="open"][role="menu"]',
];

const DEBUG = false;
function log(...args: unknown[]): void {
  if (DEBUG) console.log('[Voyager:menu]', ...args);
}

let observer: MutationObserver | null = null;

function findMenuItems(menuEl: HTMLElement): HTMLElement[] {
  // role=menuitem 是最稳的；其次 button[role=menuitem] / 退而求其次任何 button
  const items = menuEl.querySelectorAll<HTMLElement>(
    '[role="menuitem"], [role="option"], button',
  );
  return Array.from(items).filter((el) => !el.hasAttribute(INJECTED_MARKER));
}

function looksLikeChatMenu(menuEl: HTMLElement): boolean {
  const items = findMenuItems(menuEl);
  if (items.length === 0) return false;
  // 收集命中的关键字
  const texts = items.map((i) => (i.textContent ?? '').trim()).filter(Boolean);
  const hits = texts.filter((t) => CHAT_MENU_KEYWORDS.some((re) => re.test(t)));
  log('looksLikeChatMenu items=', texts, 'hits=', hits);
  // ≥1 个关键命中 + 总条数 ≤ 8（典型对话菜单不超过 8 项）即认为是对话菜单。
  // 太严容易漏，太松容易把账号菜单也注入了，这里折中。
  return hits.length >= 1 && items.length <= 8;
}

function cloneAsTemplate(template: HTMLElement, label: string): HTMLElement {
  // 浅拷贝结构，但把所有交互事件留给我们自己绑定
  const clone = template.cloneNode(true) as HTMLElement;
  clone.setAttribute(INJECTED_MARKER, 'true');
  // 移除可能的 data 属性 / id，避免和原项冲突
  clone.removeAttribute('id');
  for (const attr of Array.from(clone.attributes)) {
    if (attr.name.startsWith('data-') && attr.name !== INJECTED_MARKER) clone.removeAttribute(attr.name);
  }
  // 改文字 —— 找到看起来像文本承载点的子元素
  const textCarrier = findTextCarrier(clone) ?? clone;
  textCarrier.textContent = label;
  // 把内部图标替换成文件夹 emoji；要做得彻底就要识别 SVG / icon 容器，但我们先简单做：
  // 找第一个 svg / [class*=icon] 子元素并替换为 📁
  const icon = clone.querySelector<HTMLElement>('svg, img, [class*="icon"], [class*="Icon"]');
  if (icon && icon !== textCarrier) {
    const replacement = document.createElement('span');
    replacement.textContent = '📁';
    replacement.style.display = 'inline-flex';
    replacement.style.alignItems = 'center';
    replacement.style.justifyContent = 'center';
    replacement.style.width = '16px';
    replacement.style.height = '16px';
    replacement.style.fontSize = '14px';
    icon.replaceWith(replacement);
  }
  return clone;
}

function findTextCarrier(el: HTMLElement): HTMLElement | null {
  // 优先找有非空 text node 的最深层 element
  let best: HTMLElement | null = null;
  let bestDepth = -1;
  function walk(node: HTMLElement, depth: number): void {
    let hasOwnText = false;
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE && (child.nodeValue ?? '').trim()) {
        hasOwnText = true;
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        walk(child as HTMLElement, depth + 1);
      }
    }
    if (hasOwnText && depth > bestDepth) {
      best = node;
      bestDepth = depth;
    }
  }
  walk(el, 0);
  return best;
}

function injectInto(menuEl: HTMLElement): void {
  if (menuEl.querySelector(`[${INJECTED_MARKER}]`)) return; // 已注入过
  const chat = getLastClickedChat() ?? getCurrentChatAsFallback();
  if (!chat) return;

  const items = findMenuItems(menuEl);
  if (items.length === 0) return;

  // 找一个非删除项作模板（删除项往往有红色样式，不适合复用）
  const template =
    items.find((i) => !/delete|删除/i.test((i.textContent ?? '').trim())) ?? items[0];

  const myItem = cloneAsTemplate(template, LABEL);
  myItem.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    void showFolderPicker(chat);
    clearLastClickedChat();
    // 关掉菜单 —— ESC 是最稳的通用方案
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  });

  // 插到第一个「删除」项之前（如果有），否则末尾
  const deleteItem = items.find((i) => /delete|删除/i.test((i.textContent ?? '').trim()));
  if (deleteItem?.parentElement) {
    deleteItem.parentElement.insertBefore(myItem, deleteItem);
  } else {
    template.parentElement?.appendChild(myItem);
  }
}

function scanForMenu(root: Node): void {
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  const el = root as HTMLElement;
  // 用多个 selector 拼起来找所有可能的菜单容器
  const allMenus = new Set<HTMLElement>();
  for (const sel of MENU_CONTAINER_SELECTORS) {
    if (el.matches?.(sel)) allMenus.add(el);
    el.querySelectorAll?.<HTMLElement>(sel).forEach((m) => allMenus.add(m));
  }
  for (const m of allMenus) {
    if (looksLikeChatMenu(m)) injectInto(m);
  }
}

export function startMenuInjector(): void {
  if (observer) return;
  observer = new MutationObserver((records) => {
    for (const rec of records) {
      for (const node of rec.addedNodes) scanForMenu(node);
      // 已经存在的菜单内文字变化（i18n 翻译进来后）— 也重试一次
      if (rec.type === 'characterData' || rec.type === 'attributes') {
        const target = rec.target.nodeType === Node.ELEMENT_NODE
          ? (rec.target as HTMLElement)
          : (rec.target.parentElement);
        if (target) {
          const menu = target.closest?.('[role="menu"]') as HTMLElement | null;
          if (menu && !menu.querySelector(`[${INJECTED_MARKER}]`) && looksLikeChatMenu(menu)) {
            injectInto(menu);
          }
        }
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

export function stopMenuInjector(): void {
  observer?.disconnect();
  observer = null;
}
