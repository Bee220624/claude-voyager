import {
  loadFolders,
  createFolder,
  renameFolder,
  setFolderColor,
  deleteFolder,
  toggleFolderExpanded,
  addChatToFolder,
  removeChatFromFolder,
  moveChatToFolder,
  onFoldersChanged,
} from './store';
import { FOLDER_COLORS, type FoldersData, type Folder } from './types';

// 把文件夹面板注入到 Claude 原生侧边栏中（仿 gemini-voyager 的 sidebar 注入模式）。
//
// 流程：
//   1) 找侧边栏容器：先看含 `a[href^="/chat/"]` 的最近 nav/aside 祖先，再退而求其次
//      用 [data-testid] / aria-label 兜底；都失败就放弃（DOM 未就绪 / 不在 Claude 页）。
//   2) 找「最近」标题：通过文本匹配（'最近' / 'Recents' / 'Chats' / '对话' …）。
//      找到则插到该标题之前；找不到就插在侧边栏底部。
//   3) 用 MutationObserver 监听 sidebar 自身的子树变化：
//      - 若我们的面板被 React 重渲卸了，重新插一次（节流：每秒最多一次）。
//      - 若 sidebar 整个换了，重新走一遍 find/insert。

const PANEL_ID = 'voyager-sidebar-panel';

// 按优先级排，越靠前越精确；越靠后越宽容。
const SIDEBAR_FALLBACK_SELECTORS = [
  'nav[aria-label*="primary" i]',
  'nav[aria-label*="sidebar" i]',
  'nav[aria-label*="侧边栏"]',
  'aside[aria-label*="primary" i]',
  '[data-testid*="sidebar" i]',
  '[data-testid*="navigation" i]',
  '[class*="sidebar" i][class*="container" i]',
  // 最后的兜底：页面上唯一一个 nav 或 aside
  'nav',
  'aside',
];

// 只放真正的「最近」区块标题。
// 注意：千万不要放 'Chats' / '对话' —— 那是导航项，排在「最近」上面，会把锚点带偏到顶部。
const RECENTS_LABELS = new Set([
  '最近',
  'Recents',
  'Recent',
  'Recent chats',
  '最近对话',
  '最近的对话',
  '历史',
  'History',
]);

interface ManagerState {
  data: FoldersData;
  draggingUrl: string | null;
  draggingFrom: string | null;
}

const state: ManagerState = {
  data: { folders: [] },
  draggingUrl: null,
  draggingFrom: null,
};

let sidebar: HTMLElement | null = null;
let sidebarObserver: MutationObserver | null = null;
let unsubFolders: (() => void) | null = null;
let pathPollHandle: number | null = null;
let lastReinsert = 0;
let urlPath = location.pathname;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function looksLikeSidebar(el: HTMLElement): boolean {
  // 排除 body / html / root 这种过大容器
  if (!el || el === document.body || el === document.documentElement) return false;
  if (el.id === 'root' || el.id === '__next') return false;
  const rect = el.getBoundingClientRect();
  // 侧边栏通常 ≤ 360px 宽，至少 200px 高，且偏靠左
  if (rect.width === 0 || rect.height === 0) return false; // 不可见
  if (rect.width > 480) return false;
  if (rect.height < 120) return false;
  // 偏靠左（右边沿不超过窗口宽度的一半 + 一点容差）
  if (rect.left > window.innerWidth / 2) return false;
  return true;
}

function findSidebar(): HTMLElement | null {
  // Strategy 1: 含 chat 链接的最近 nav/aside
  const anyChat = document.querySelector<HTMLAnchorElement>('a[href^="/chat/"]');
  if (anyChat) {
    let cur: HTMLElement | null = anyChat.parentElement;
    while (cur && cur !== document.body) {
      if (cur.matches('nav, aside, [role="navigation"]')) return cur;
      cur = cur.parentElement;
    }
  }

  // Strategy 2: 选择器兜底 + 用 looksLikeSidebar 过滤
  for (const sel of SIDEBAR_FALLBACK_SELECTORS) {
    const els = document.querySelectorAll<HTMLElement>(sel);
    for (const el of Array.from(els)) {
      if (looksLikeSidebar(el)) return el;
    }
  }

  // Strategy 3: 多个 /chat/ 链接的共同祖先 + 可滚动
  const allChatLinks = document.querySelectorAll<HTMLAnchorElement>('a[href^="/chat/"]');
  if (allChatLinks.length >= 2) {
    let cur: HTMLElement | null = allChatLinks[0].parentElement;
    while (cur && cur !== document.body) {
      if (Array.from(allChatLinks).every((a) => cur!.contains(a))) {
        const cs = getComputedStyle(cur);
        if (/(auto|scroll)/.test(cs.overflowY) && looksLikeSidebar(cur)) return cur;
      }
      cur = cur.parentElement;
    }
  }

  // Strategy 4: 暴力扫描所有 div，找符合 looksLikeSidebar 且含 "新建对话/New chat" 文本的
  const allDivs = document.querySelectorAll<HTMLElement>('#root div');
  for (const el of Array.from(allDivs)) {
    if (!looksLikeSidebar(el)) continue;
    const text = el.textContent ?? '';
    if (/(新建对话|New chat|新建聊天)/i.test(text) && /(对话|Chats|项目|Projects|最近|Recents)/i.test(text)) {
      return el;
    }
  }

  return null;
}

/** 取元素「自己的」直接文本（不含后代），用于精确匹配标签文字。 */
function ownText(el: HTMLElement): string {
  let s = '';
  for (const n of Array.from(el.childNodes)) {
    if (n.nodeType === Node.TEXT_NODE) s += n.nodeValue ?? '';
  }
  return s.trim();
}

/**
 * 找「最近」区块的锚点：返回一个元素，把面板插到它前面，
 * 就能落在「新建对话…更多」导航区 与「最近 + 对话列表」之间。
 *
 * 做法：先找 own-text 命中 RECENTS_LABELS 的标题元素，
 * 再把它向上爬，直到「它和对话列表 <ul> 是同一父容器下的兄弟」，返回这个兄弟级 wrapper。
 */
function findRecentsAnchor(within: HTMLElement): HTMLElement | null {
  // 收集所有 own-text 命中「最近」的元素。可能有多个（极少），取最靠近对话列表的那个。
  const matches: HTMLElement[] = [];
  const candidates = within.querySelectorAll<HTMLElement>(
    'h1, h2, h3, h4, h5, h6, span, div, p, [class*="heading" i], [class*="title" i], [class*="label" i]',
  );
  for (const c of Array.from(candidates)) {
    if (RECENTS_LABELS.has(ownText(c))) matches.push(c);
  }
  if (matches.length === 0) return null;

  const firstChatLink = within.querySelector<HTMLAnchorElement>('a[href^="/chat/"]');
  const list = firstChatLink?.closest('ul, ol, [role="list"]') ?? null;

  // 取「最近」标题——文档顺序里最后一个（最贴近对话列表），避免误中靠上的同名项。
  let header = matches[matches.length - 1];
  if (list) {
    // 若能拿到列表，优先选「在列表之前、且离列表最近」的那个标题
    const before = matches.filter(
      (m) => m.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING,
    );
    if (before.length > 0) header = before[before.length - 1];
  }

  // 纯结构爬升，不依赖对话列表是否存在（折叠「最近」时列表会从 DOM 消失）：
  // 从 header 往上爬，只要它仍是父容器的第一个元素子节点，就说明这层 wrapper 仍以「最近」打头，继续爬；
  // 一旦它前面出现了别的兄弟（比如导航区），就停在当前这层 —— 把面板插到它前面正好落在「导航区」与「最近」之间。
  // 这样无论列表在不在，锚点位置都一致。
  let block: HTMLElement = header;
  let depth = 0;
  while (
    block.parentElement &&
    block.parentElement !== within &&
    block.parentElement.firstElementChild === block &&
    depth < 8
  ) {
    block = block.parentElement;
    depth++;
  }
  return block;
}

function renderFolderItemHTML(folder: Folder): string {
  const expanded = folder.expanded ?? true;
  const color = folder.color ?? '#c76946';
  const chats = folder.chats
    .map((c) => {
      const active = location.pathname === c.url ? ' is-active' : '';
      return `
      <li class="voyager-sf-chat${active}"
          data-voyager-ui="folders"
          data-role="chat"
          data-folder-id="${folder.id}"
          data-url="${escapeHtml(c.url)}"
          draggable="true"
          title="${escapeHtml(c.title)}">
        <span class="voyager-sf-chat__title" data-voyager-ui="folders">${escapeHtml(c.title)}</span>
        <button class="voyager-sf-chat__remove" type="button"
                data-voyager-ui="folders" data-role="remove-chat"
                data-folder-id="${folder.id}" data-url="${escapeHtml(c.url)}"
                aria-label="从此文件夹移除" title="移除">×</button>
      </li>`;
    })
    .join('');
  return `
    <li class="voyager-sf-folder${expanded ? ' is-expanded' : ''}"
        data-voyager-ui="folders" data-role="folder" data-folder-id="${folder.id}">
      <div class="voyager-sf-folder__header" data-voyager-ui="folders" data-role="folder-header" data-folder-id="${folder.id}">
        <span class="voyager-sf-folder__chevron" data-voyager-ui="folders">▶</span>
        <span class="voyager-sf-folder__dot" data-voyager-ui="folders" style="background:${color}"></span>
        <span class="voyager-sf-folder__name" data-voyager-ui="folders" data-role="folder-name">${escapeHtml(folder.name)}</span>
        <span class="voyager-sf-folder__count" data-voyager-ui="folders">${folder.chats.length}</span>
        <button class="voyager-sf-folder__more" type="button"
                data-voyager-ui="folders" data-role="folder-menu" data-folder-id="${folder.id}"
                aria-label="重命名 / 换色 / 删除" title="重命名 / 换色 / 删除">⋯</button>
      </div>
      <ul class="voyager-sf-folder__chats" data-voyager-ui="folders">${chats || `<li class="voyager-sf-folder__empty" data-voyager-ui="folders">空 — 拖一个对话过来 或 在对话三点菜单选「加入文件夹」</li>`}</ul>
    </li>`;
}

function buildPanel(): HTMLElement {
  const root = document.createElement('section');
  root.id = PANEL_ID;
  root.setAttribute('data-voyager-ui', 'folders');
  root.setAttribute('data-voyager-skip-i18n', 'true');
  root.className = 'voyager-sf';

  root.innerHTML = `
    <div class="voyager-sf__header" data-voyager-ui="folders">
      <span class="voyager-sf__title" data-voyager-ui="folders">📁 文件夹</span>
      <button class="voyager-sf__btn" type="button" data-voyager-ui="folders" data-role="new-folder" aria-label="新建文件夹" title="新建文件夹">＋</button>
    </div>
    <ul class="voyager-sf__list" data-voyager-ui="folders"></ul>
  `;

  // 事件委托：所有交互绑在 root 上一次性绑定
  root.addEventListener('click', onClick);
  root.addEventListener('dblclick', onDblClick);
  root.addEventListener('dragstart', onDragStart);
  root.addEventListener('dragover', onDragOver);
  root.addEventListener('drop', onDrop);
  root.addEventListener('dragend', onDragEnd);
  return root;
}

function renderList(root: HTMLElement): void {
  const list = root.querySelector<HTMLElement>('.voyager-sf__list');
  if (!list) return;
  const folders = state.data.folders;
  if (folders.length === 0) {
    list.innerHTML = `<li class="voyager-sf__empty" data-voyager-ui="folders">点上方 ＋ 创建第一个文件夹</li>`;
    return;
  }
  list.innerHTML = folders.map(renderFolderItemHTML).join('');
}

async function onClick(ev: Event): Promise<void> {
  const target = ev.target as HTMLElement;
  const role = target.closest<HTMLElement>('[data-role]')?.dataset.role;
  if (!role) return;
  switch (role) {
    case 'new-folder': {
      const name = window.prompt('文件夹名称', '新文件夹');
      if (!name) return;
      const color = FOLDER_COLORS[state.data.folders.length % FOLDER_COLORS.length];
      await createFolder(name, color);
      return;
    }
    case 'folder-header': {
      const id = target.closest<HTMLElement>('[data-folder-id]')!.dataset.folderId!;
      await toggleFolderExpanded(id);
      return;
    }
    case 'folder-menu': {
      ev.stopPropagation();
      const id = target.closest<HTMLElement>('[data-folder-id]')!.dataset.folderId!;
      const folder = state.data.folders.find((f) => f.id === id);
      if (!folder) return;
      const action = window.prompt(
        `操作 "${folder.name}"：\n  R = 重命名\n  C = 换颜色\n  D = 删除`,
        'R',
      );
      if (!action) return;
      const a = action.trim().toUpperCase();
      if (a === 'R') {
        const newName = window.prompt('新名称', folder.name);
        if (newName && newName !== folder.name) await renameFolder(id, newName);
      } else if (a === 'C') {
        const idx = FOLDER_COLORS.indexOf((folder.color ?? '') as (typeof FOLDER_COLORS)[number]);
        const next = FOLDER_COLORS[(idx + 1) % FOLDER_COLORS.length];
        await setFolderColor(id, next);
      } else if (a === 'D') {
        if (window.confirm(`确认删除文件夹 "${folder.name}"？里面的对话不会被删除，只是从文件夹移除。`)) {
          await deleteFolder(id);
        }
      }
      return;
    }
    case 'chat': {
      ev.preventDefault();
      const url = target.closest<HTMLElement>('[data-url]')!.dataset.url!;
      if (url && url !== location.pathname) navigateTo(url);
      return;
    }
    case 'remove-chat': {
      ev.stopPropagation();
      const folderId = target.dataset.folderId!;
      const url = target.dataset.url!;
      await removeChatFromFolder(folderId, url);
      return;
    }
  }
}

function navigateTo(url: string): void {
  // 模拟 SPA 链接点击，避免完整 reload
  history.pushState({}, '', url);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

async function onDblClick(ev: Event): Promise<void> {
  const target = ev.target as HTMLElement;
  if (target.dataset.role === 'folder-name') {
    const id = target.closest<HTMLElement>('[data-folder-id]')!.dataset.folderId!;
    const folder = state.data.folders.find((f) => f.id === id);
    if (!folder) return;
    const newName = window.prompt('重命名为', folder.name);
    if (newName && newName !== folder.name) await renameFolder(id, newName);
  }
}

function onDragStart(ev: Event): void {
  const e = ev as DragEvent;
  const li = (e.target as HTMLElement).closest<HTMLElement>('[data-role="chat"]');
  if (!li) return;
  state.draggingUrl = li.dataset.url ?? null;
  state.draggingFrom = li.dataset.folderId ?? null;
  e.dataTransfer?.setData('text/plain', state.draggingUrl ?? '');
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
}

function onDragOver(ev: Event): void {
  const e = ev as DragEvent;
  const folderLi = (e.target as HTMLElement).closest<HTMLElement>('[data-role="folder"]');
  if (!folderLi) return;
  // 内部拖（面板内对话项移动）或外部拖（Claude 侧边栏的 <a href="/chat/...">）都接受
  const isInternal = !!state.draggingUrl;
  const isExternal = Array.from(e.dataTransfer?.types ?? []).some(
    (t) => t === 'text/uri-list' || t === 'text/plain',
  );
  if (!isInternal && !isExternal) return;
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = isInternal ? 'move' : 'copy';
  folderLi.classList.add('is-drop-target');
}

/** 从一段拖拽文本里抠出 /chat/<uuid> 路径。 */
function extractChatPath(text: string): string | null {
  const m = text.match(/\/chat\/[0-9a-f-]+/i);
  return m ? m[0] : null;
}

/** 给定 chat 路径，从 Claude 侧边栏对应链接抓标题（抓不到就用占位）。 */
function titleForChatPath(path: string): string {
  const a = document.querySelector<HTMLAnchorElement>(`a[href="${path}"], a[href^="${path}?"]`);
  if (a) {
    const aria = a.getAttribute('aria-label');
    if (aria?.trim()) return aria.trim();
    const text = (a.textContent ?? '').trim();
    if (text) return text;
  }
  return '未命名对话';
}

async function onDrop(ev: Event): Promise<void> {
  const e = ev as DragEvent;
  const folderLi = (e.target as HTMLElement).closest<HTMLElement>('[data-role="folder"]');
  if (!folderLi) return;
  e.preventDefault();
  folderLi.classList.remove('is-drop-target');
  const toId = folderLi.dataset.folderId!;

  if (state.draggingUrl) {
    // 面板内部移动
    if (state.draggingFrom && state.draggingFrom !== toId) {
      await moveChatToFolder(state.draggingFrom, toId, state.draggingUrl);
    }
  } else {
    // 外部拖入：从 dataTransfer 解析 /chat/ 路径
    const raw =
      e.dataTransfer?.getData('text/uri-list') || e.dataTransfer?.getData('text/plain') || '';
    const path = extractChatPath(raw);
    if (path) {
      await addChatToFolder(toId, {
        url: path,
        title: titleForChatPath(path),
        addedAt: Date.now(),
      });
    }
  }
  state.draggingUrl = null;
  state.draggingFrom = null;
}

function onDragEnd(_ev: Event): void {
  ensurePanelEl()
    ?.querySelectorAll('.is-drop-target')
    .forEach((n) => n.classList.remove('is-drop-target'));
  state.draggingUrl = null;
  state.draggingFrom = null;
}

function ensurePanelEl(): HTMLElement | null {
  return document.getElementById(PANEL_ID);
}

/** 把 panel 放到正确位置；幂等：已在正确位置则不动（避免 observer 抖动）。 */
function positionPanel(panel: HTMLElement): void {
  if (!sidebar) return;
  const anchor = findRecentsAnchor(sidebar);
  if (anchor && anchor.parentElement) {
    // 期望：panel 紧贴在 anchor 前面，且和 anchor 同父
    if (panel.parentElement === anchor.parentElement && panel.nextElementSibling === anchor) {
      return; // 已就位
    }
    anchor.parentElement.insertBefore(panel, anchor);
  } else {
    // 还没找到「最近」（可能列表未渲染）→ 暂时放 sidebar 顶部，等列表出来后再纠正
    if (panel.parentElement === sidebar && sidebar.firstElementChild === panel) return;
    sidebar.insertBefore(panel, sidebar.firstChild);
  }
}

function insertPanel(): boolean {
  if (!sidebar) return false;
  const existing = ensurePanelEl();

  // 节流：被反复重渲卸载时不要每次都狂插
  const now = Date.now();
  if (existing && sidebar.contains(existing)) {
    // 已在 sidebar 里 —— 只确保位置正确并刷新内容
    positionPanel(existing);
    renderList(existing);
    return true;
  }
  if (now - lastReinsert < 200) return false;
  lastReinsert = now;

  const panel = existing ?? buildPanel();
  positionPanel(panel);
  renderList(panel);

  const sr = sidebar.getBoundingClientRect();
  const pr = panel.getBoundingClientRect();
  console.log(
    `%c[Voyager] panel positioned | panel rect=${Math.round(pr.x)},${Math.round(pr.y)} ${Math.round(pr.width)}×${Math.round(pr.height)}` +
      ` ${pr.width === 0 || pr.height === 0 ? '⚠ 不可见!' : '✓ 可见'}`,
    'color:#c76946',
  );
  return true;
}

function watchSidebar(): void {
  sidebarObserver?.disconnect();
  if (!sidebar) return;
  sidebarObserver = new MutationObserver(() => {
    if (!sidebar) return;
    const el = ensurePanelEl();
    if (!el || !sidebar.contains(el)) {
      insertPanel(); // 掉出 sidebar → 补插
    } else {
      positionPanel(el); // 还在 → 确保位置正确（「最近」渲染出来后纠正到它前面）
    }
  });
  sidebarObserver.observe(sidebar, { childList: true, subtree: true });
}

async function waitForSidebar(timeoutMs = 10000): Promise<HTMLElement | null> {
  const start = Date.now();
  return new Promise((resolve) => {
    const tick = () => {
      const found = findSidebar();
      if (found) return resolve(found);
      if (Date.now() - start > timeoutMs) return resolve(null);
      window.setTimeout(tick, 250);
    };
    tick();
  });
}

let bodyObserver: MutationObserver | null = null;

/** sidebar 还没出现时（折叠态、SPA 路由变化）持续监听 body，等它出现就接管。 */
function startBodyObserver(): void {
  if (bodyObserver) return;
  bodyObserver = new MutationObserver(() => {
    if (sidebar && document.body.contains(sidebar)) return; // 已经有了
    const found = findSidebar();
    if (found) {
      sidebar = found;
      insertPanel();
      watchSidebar();
    }
  });
  bodyObserver.observe(document.body, { childList: true, subtree: true });
}

function stopBodyObserver(): void {
  bodyObserver?.disconnect();
  bodyObserver = null;
}

export async function enableSidebarPanel(): Promise<void> {
  state.data = await loadFolders();

  // 同时启动「等待 + body 观察」两条路径；先到先得。
  // body 观察持续运行，sidebar 折叠/展开切换时也能被接住。
  startBodyObserver();
  sidebar = await waitForSidebar();
  if (sidebar) {
    insertPanel();
    watchSidebar();
    console.log('%c[Voyager] 侧边栏面板已注入', 'color:#c76946');
  } else {
    console.warn(
      '%c[Voyager] 10 秒内没找到侧边栏。若侧边栏当前折叠，展开后会自动注入。\n如果展开后仍未出现，请在 console 输入 __voyager.diag() 把诊断信息发给开发者。',
      'color:#c76946',
    );
  }

  if (!unsubFolders) {
    unsubFolders = onFoldersChanged((next) => {
      state.data = next;
      const el = ensurePanelEl();
      if (el) renderList(el);
    });
  }

  if (pathPollHandle === null) {
    pathPollHandle = window.setInterval(() => {
      if (location.pathname !== urlPath) {
        urlPath = location.pathname;
        const el = ensurePanelEl();
        if (el) renderList(el); // 高亮当前对话所在的文件夹项
      }
    }, 500);
  }
}

export function disableSidebarPanel(): void {
  sidebarObserver?.disconnect();
  sidebarObserver = null;
  stopBodyObserver();
  unsubFolders?.();
  unsubFolders = null;
  if (pathPollHandle !== null) {
    clearInterval(pathPollHandle);
    pathPollHandle = null;
  }
  ensurePanelEl()?.remove();
  sidebar = null;
}
