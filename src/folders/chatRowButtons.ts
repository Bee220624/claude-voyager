import { showFolderPicker } from './pickerDialog';
import { loadFolders } from './store';
import { findFoldersContaining } from './store';

// 在 Claude 侧边栏每条对话行上注入一个「📁 加入文件夹」悬停按钮。
//
// 为什么不走三点菜单注入：Claude 的菜单 DOM 结构 / role 不稳定，多版本失败。
// 行内按钮完全由我们掌控：从 <a href="/chat/..."> 直接拿 url + 标题，可靠。
//
// React 会在重渲时清掉我们的按钮 → MutationObserver 节流补注入。

const BTN_MARKER = 'data-voyager-row-btn';
const HOST_CLASS = 'voyager-row-host';

let observer: MutationObserver | null = null;
let scheduled = false;

function extractTitle(a: HTMLAnchorElement): string {
  const aria = a.getAttribute('aria-label');
  if (aria && aria.trim()) return aria.trim();
  const t = a.getAttribute('title');
  if (t && t.trim()) return t.trim();
  return (a.textContent ?? '').trim() || '未命名对话';
}

/** 找承载绝对定位按钮的 host：优先 a 的直接父（通常是 .relative.group）。 */
function findHost(a: HTMLAnchorElement): HTMLElement | null {
  const parent = a.parentElement;
  if (!parent) return null;
  // 如果父节点窄于行（比如 a 自己就是 flex item），往上找到 li 内最外层 div
  return parent;
}

async function refreshButtonStates(): Promise<void> {
  // 给已加入文件夹的对话行的按钮点亮（实心），方便一眼看出哪些已归类
  const data = await loadFolders();
  document.querySelectorAll<HTMLButtonElement>(`[${BTN_MARKER}]`).forEach((btn) => {
    const url = btn.getAttribute('data-url') ?? '';
    const inFolders = findFoldersContaining(data, url);
    btn.classList.toggle('is-filed', inFolders.length > 0);
    btn.title = inFolders.length > 0 ? `已在：${inFolders.map((f) => f.name).join('、')}` : '加入文件夹';
  });
}

function injectButtons(): void {
  const links = document.querySelectorAll<HTMLAnchorElement>('a[href^="/chat/"]');
  let added = false;
  for (const a of Array.from(links)) {
    const host = findHost(a);
    if (!host) continue;
    if (host.querySelector(`[${BTN_MARKER}]`)) continue; // 已注入

    // 确保 host 是定位上下文
    const cs = getComputedStyle(host);
    if (cs.position === 'static') host.style.position = 'relative';
    host.classList.add(HOST_CLASS);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'voyager-row-folder-btn';
    btn.setAttribute(BTN_MARKER, 'true');
    btn.setAttribute('data-voyager-ui', 'folders');
    btn.setAttribute('data-voyager-skip-i18n', 'true');
    btn.setAttribute('data-url', a.pathname);
    btn.setAttribute('aria-label', '加入文件夹');
    btn.title = '加入文件夹';
    btn.textContent = '📁';

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      void showFolderPicker({ url: a.pathname, title: extractTitle(a) });
    });
    // 阻止冒泡到 Claude 的行点击（否则会顺带导航）
    btn.addEventListener('mousedown', (e) => e.stopPropagation());

    host.appendChild(btn);
    added = true;
  }
  if (added) void refreshButtonStates();
}

function schedule(): void {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    injectButtons();
  });
}

export function startChatRowButtons(): void {
  if (observer) return;
  injectButtons();
  void refreshButtonStates();
  observer = new MutationObserver(() => schedule());
  observer.observe(document.body, { childList: true, subtree: true });
  // 文件夹数据变化时刷新按钮点亮态
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && 'voyager.folders' in changes) void refreshButtonStates();
  });
}

export function stopChatRowButtons(): void {
  observer?.disconnect();
  observer = null;
  document.querySelectorAll(`[${BTN_MARKER}]`).forEach((b) => b.remove());
  document.querySelectorAll(`.${HOST_CLASS}`).forEach((h) => h.classList.remove(HOST_CLASS));
}
