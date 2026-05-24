import { collectUserMessages, findScrollContainer, type UserMessage } from './detector';
import { updateSetting, type VoyagerSettings } from '../storage/settings';

// 时间轴的所有 DOM 操作都集中在这个模块；UI 通过 data-voyager-ui 标识，
// i18n 的 walk() 会跳过它，避免我们自己写的中文又被反向匹配出问题。

const ROOT_ID = 'voyager-timeline-root';
const STARRED_KEY = 'voyager.starred';

interface StarredMap {
  // key 是会话 path（location.pathname），value 是该会话中星标的消息 hash 列表
  [path: string]: string[];
}

let messages: UserMessage[] = [];
let scrollContainer: HTMLElement | null = null;
let boundScrollTarget: HTMLElement | Window | null = null;
let observer: MutationObserver | null = null;
let scrollHandler: (() => void) | null = null;
let rafScheduled = false;
let currentSettings: VoyagerSettings | null = null;
let starredForPath: Set<string> = new Set();
let lastPath = location.pathname;
let urlPollHandle: number | null = null;

async function loadStarred(): Promise<Set<string>> {
  const data = await chrome.storage.local.get(STARRED_KEY);
  const map = (data[STARRED_KEY] as StarredMap | undefined) ?? {};
  return new Set(map[location.pathname] ?? []);
}

async function persistStarred(): Promise<void> {
  const data = await chrome.storage.local.get(STARRED_KEY);
  const map = (data[STARRED_KEY] as StarredMap | undefined) ?? {};
  map[location.pathname] = Array.from(starredForPath);
  await chrome.storage.local.set({ [STARRED_KEY]: map });
}

function ensureRoot(): HTMLElement {
  let root = document.getElementById(ROOT_ID);
  if (root) return root;
  root = document.createElement('div');
  root.id = ROOT_ID;
  root.setAttribute('data-voyager-ui', 'timeline');
  root.innerHTML = `
    <div class="voyager-timeline" data-voyager-ui="timeline">
      <div class="voyager-timeline__header" data-voyager-ui="timeline">
        <span class="voyager-timeline__title" data-voyager-ui="timeline">时间轴</span>
        <button class="voyager-timeline__pin" data-voyager-ui="timeline" data-role="toggle-pin" type="button" aria-label="固定预览" title="固定预览（点击切换悬停模式 / 常驻模式）">
          <span class="voyager-timeline__pin-icon" data-voyager-ui="timeline">📌</span>
        </button>
        <span class="voyager-timeline__progress" data-voyager-ui="timeline">0%</span>
      </div>
      <div class="voyager-timeline__progressbar" data-voyager-ui="timeline">
        <div class="voyager-timeline__progressbar-fill" data-voyager-ui="timeline"></div>
      </div>
      <div class="voyager-timeline__track" data-voyager-ui="timeline">
        <div class="voyager-timeline__rail" data-voyager-ui="timeline"></div>
        <div class="voyager-timeline__nodes" data-voyager-ui="timeline"></div>
        <div class="voyager-timeline__viewport" data-voyager-ui="timeline" hidden></div>
      </div>
      <div class="voyager-timeline__footer" data-voyager-ui="timeline">
        <span class="voyager-timeline__count" data-voyager-ui="timeline">0 条</span>
      </div>
    </div>
  `;
  // 固定按钮的点击单独绑定（renderNodes 重渲不影响）
  root.querySelector('[data-role="toggle-pin"]')?.addEventListener('click', () => {
    void togglePin();
  });
  document.body.appendChild(root);
  return root;
}

async function togglePin(): Promise<void> {
  if (!currentSettings) return;
  await updateSetting('previewPinned', !currentSettings.previewPinned);
}

/** 根据 settings 切 modifier 类，CSS 负责实际样式。 */
function syncRootClasses(): void {
  if (!currentSettings) return;
  const panel = ensureRoot().querySelector<HTMLElement>('.voyager-timeline');
  if (!panel) return;
  panel.classList.toggle('is-pinned', currentSettings.previewPinned);
  panel.classList.toggle('has-progress', currentSettings.showProgress);
  const pinBtn = panel.querySelector<HTMLElement>('.voyager-timeline__pin');
  if (pinBtn) {
    pinBtn.classList.toggle('is-on', currentSettings.previewPinned);
    pinBtn.title = currentSettings.previewPinned ? '取消固定（恢复悬停模式）' : '固定预览（常驻显示）';
  }
}

function nodesContainer(): HTMLElement {
  return ensureRoot().querySelector<HTMLElement>('.voyager-timeline__nodes')!;
}

function renderNodes(): void {
  if (!currentSettings) return;
  const host = nodesContainer();
  // 全量重渲染足够便宜（典型对话不到 100 条消息），不做 diff。
  host.replaceChildren();
  // 预览 span 始终渲染；显隐由 CSS 控制（.is-pinned 常驻 / 否则悬停展开）。
  for (const m of messages) {
    const isStarred = starredForPath.has(m.hash);
    const previewText = m.preview || `第 ${m.index} 条`;
    // 节点里放完整文字（截 240 防过长）。平时 CSS 截成一行带省略号，
    // 悬停该节点时就地换行展开 —— 不弹 tooltip 框。
    const inlineText = (m.fullText || previewText).slice(0, 240);
    const li = document.createElement('button');
    li.type = 'button';
    li.className = 'voyager-node';
    li.setAttribute('data-voyager-ui', 'timeline');
    li.setAttribute('data-index', String(m.index));
    li.setAttribute('data-hash', m.hash);
    // 不设 li.title —— 用户不要原生 tooltip 弹框
    li.setAttribute('aria-label', `跳转到第 ${m.index} 条消息：${previewText}`);
    li.innerHTML = `
      <span class="voyager-node__dot${isStarred ? ' is-starred' : ''}" data-voyager-ui="timeline"></span>
      <span class="voyager-node__preview" data-voyager-ui="timeline">${escapeHtml(inlineText)}</span>
      <span class="voyager-node__star${isStarred ? ' is-on' : ''}" data-voyager-ui="timeline" data-role="star" aria-label="${isStarred ? '取消收藏' : '收藏该消息'}">★</span>
    `;
    li.addEventListener('click', (ev) => {
      const target = ev.target as HTMLElement;
      if (target.dataset.role === 'star') {
        ev.stopPropagation();
        toggleStar(m.hash);
        return;
      }
      scrollTo(m);
    });
    host.appendChild(li);
  }
  updateCount();
}

function updateCount(): void {
  const el = ensureRoot().querySelector<HTMLElement>('.voyager-timeline__count');
  if (el) el.textContent = `${messages.length} 条`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function scrollTo(m: UserMessage): void {
  if (!document.body.contains(m.el)) return;
  m.el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  // 高亮一下，方便用户在长对话中确认位置
  m.el.animate(
    [
      { boxShadow: '0 0 0 0 rgba(199, 105, 70, 0.0)' },
      { boxShadow: '0 0 0 6px rgba(199, 105, 70, 0.35)' },
      { boxShadow: '0 0 0 0 rgba(199, 105, 70, 0.0)' },
    ],
    { duration: 1200, easing: 'ease-out' },
  );
}

async function toggleStar(hash: string): Promise<void> {
  if (starredForPath.has(hash)) starredForPath.delete(hash);
  else starredForPath.add(hash);
  await persistStarred();
  renderNodes();
}

function updateActiveAndProgress(): void {
  if (!currentSettings || !scrollContainer) return;

  const root = ensureRoot();
  const progressEl = root.querySelector<HTMLElement>('.voyager-timeline__progress');
  const progressFillEl = root.querySelector<HTMLElement>('.voyager-timeline__progressbar-fill');
  const viewportEl = root.querySelector<HTMLElement>('.voyager-timeline__viewport');
  const trackEl = root.querySelector<HTMLElement>('.voyager-timeline__track');

  // 阅读进度 = (scrollTop + clientHeight/2) / scrollHeight
  const isWindowScroll = scrollContainer === document.documentElement || scrollContainer === document.body;
  const scrollTop = isWindowScroll ? window.scrollY : scrollContainer.scrollTop;
  const clientH = isWindowScroll ? window.innerHeight : scrollContainer.clientHeight;
  const scrollH = isWindowScroll
    ? Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)
    : scrollContainer.scrollHeight;
  const maxScroll = Math.max(1, scrollH - clientH);
  const ratio = Math.min(1, Math.max(0, scrollTop / maxScroll));
  const percent = Math.round(ratio * 100);

  if (progressEl) progressEl.textContent = `${percent}%`;
  if (progressFillEl) progressFillEl.style.width = `${percent}%`;

  // 视口指示器：在 track 上显示一个反映当前阅读位置的滑块
  if (viewportEl && trackEl && currentSettings.showProgress) {
    viewportEl.hidden = false;
    const trackH = trackEl.clientHeight;
    const sliderH = Math.max(20, Math.round((clientH / scrollH) * trackH));
    const sliderY = Math.round(ratio * (trackH - sliderH));
    viewportEl.style.height = `${sliderH}px`;
    viewportEl.style.transform = `translateY(${sliderY}px)`;
  } else if (viewportEl) {
    viewportEl.hidden = true;
  }

  // 高亮「当前正在阅读」的消息节点：取视口中线最近的一条
  const midline = (isWindowScroll ? 0 : scrollContainer.getBoundingClientRect().top) + clientH / 2;
  let closestIdx = -1;
  let closestDist = Infinity;
  messages.forEach((m, idx) => {
    if (!document.body.contains(m.el)) return;
    const rect = m.el.getBoundingClientRect();
    const centerY = rect.top + rect.height / 2;
    const dist = Math.abs(centerY - midline);
    if (dist < closestDist) {
      closestDist = dist;
      closestIdx = idx;
    }
  });

  root.querySelectorAll<HTMLElement>('.voyager-node').forEach((n, i) => {
    n.classList.toggle('is-active', i === closestIdx);
  });
}

function scheduleUpdate(): void {
  if (rafScheduled) return;
  rafScheduled = true;
  requestAnimationFrame(() => {
    rafScheduled = false;
    updateActiveAndProgress();
  });
}

let starredLoadedForPath: string | null = null;

async function refresh(): Promise<void> {
  if (!currentSettings) return;
  messages = collectUserMessages();
  const prevContainer = scrollContainer;
  scrollContainer = findScrollContainer(messages[0]?.el);
  rebindScrollIfNeeded(prevContainer);
  // 仅在切换会话时重新加载收藏数据，避免每次 DOM 变化都打 storage
  if (starredLoadedForPath !== location.pathname) {
    starredForPath = await loadStarred();
    starredLoadedForPath = location.pathname;
  }
  renderNodes();
  scheduleUpdate();
  // 没消息时把整个面板隐藏，避免在首页空荡荡
  ensureRoot().classList.toggle('is-empty', messages.length === 0);
}

function bindScroll(): void {
  if (!scrollHandler) scrollHandler = () => scheduleUpdate();
  // 同 window scroll 始终绑（不同布局下滚动源不同）
  if (boundScrollTarget !== window) {
    window.addEventListener('scroll', scrollHandler, { passive: true });
    boundScrollTarget = window;
  }
  if (scrollContainer && scrollContainer !== document.documentElement) {
    scrollContainer.addEventListener('scroll', scrollHandler, { passive: true });
  }
}

function unbindScroll(): void {
  if (!scrollHandler) return;
  window.removeEventListener('scroll', scrollHandler);
  if (scrollContainer && scrollContainer !== document.documentElement) {
    scrollContainer.removeEventListener('scroll', scrollHandler);
  }
  scrollHandler = null;
  boundScrollTarget = null;
}

function rebindScrollIfNeeded(prev: HTMLElement | null): void {
  if (!scrollHandler) return;
  // SPA 切换会话后滚动容器换了，需要把旧容器的监听摘掉再绑新的
  if (prev && prev !== document.documentElement && prev !== scrollContainer) {
    prev.removeEventListener('scroll', scrollHandler);
  }
  if (scrollContainer && scrollContainer !== document.documentElement) {
    scrollContainer.addEventListener('scroll', scrollHandler, { passive: true });
  }
}

function watchPageMutations(): void {
  if (observer) return;
  observer = new MutationObserver(() => {
    // 防抖：合并到下一帧
    if (!rafScheduled) {
      rafScheduled = true;
      requestAnimationFrame(() => {
        rafScheduled = false;
        void refresh();
      });
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

function watchUrl(): void {
  if (urlPollHandle !== null) return;
  // claude.ai 是 SPA，URL 变化没有可靠事件 → 轮询。开销可忽略。
  urlPollHandle = window.setInterval(() => {
    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      void refresh();
    }
  }, 500);
}

export function enableTimeline(settings: VoyagerSettings): void {
  currentSettings = settings;
  ensureRoot().style.display = '';
  syncRootClasses();
  void refresh().then(() => {
    bindScroll();
    watchPageMutations();
    watchUrl();
  });
}

export function updateTimelineSettings(settings: VoyagerSettings): void {
  currentSettings = settings;
  syncRootClasses();
  renderNodes();
  scheduleUpdate();
}

export function disableTimeline(): void {
  observer?.disconnect();
  observer = null;
  unbindScroll();
  if (urlPollHandle !== null) {
    clearInterval(urlPollHandle);
    urlPollHandle = null;
  }
  const root = document.getElementById(ROOT_ID);
  if (root) root.remove();
}
