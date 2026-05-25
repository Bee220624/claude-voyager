// 把诊断接口挂到 window.__voyager，让用户在 console 里调用，避免他们去 F12 翻 DOM。
//
// 在 content script 这种 isolated world 里挂 window 不会污染页面：页面脚本看不到 window.__voyager。
// 但用户在 DevTools 选 "Top" 上下文执行 console 命令时也看不到（DevTools 默认是 page world）。
// 为了让 console 能调用，我们用 wrappedJSObject 模式 + 一个跨域桥：
//   - 在 isolated world 里把 API 序列化成 JSON，写到一个 data-voyager-diag <script> 元素上；
//   - 再在 page world 里执行一个小桥，把 __voyager 拼到 window 上，转发到 isolated world。
//
// 这套桥的常见做法是 dispatchEvent + custom events。下面是简化版：
//   - isolated world 监听 custom event 'voyager:diag-request'
//   - 收到后把结果用 'voyager:diag-response' 派出去
//   - page world 的 __voyager.* 都是 promise wrapper，发请求等响应。

import { loadFolders } from '../folders/store';
import { loadSettings } from '../storage/settings';
import { findUserMessageElements, extractCleanText } from '../timeline/detector';
import { TEXT_DICT, EXACT_WORDS, PATTERN_REPLACEMENTS } from '../i18n/zh-CN';
import { getCacheSnapshot, getMtStatus } from '../i18n/mt';

interface DiagReport {
  version: string;
  url: string;
  pathname: string;
  voyager: {
    timelineRoot: boolean;
    timelineEmpty: boolean;
    sidebarPanel: boolean;
    panelLocation: PanelLocation | null;
    menuInjector: { observed: boolean };
  };
  page: {
    bodyClass: string;
    hasReactRoot: boolean;
    chatLinks: number;
    chatLinksSample: Array<{ href: string; text: string }>;
    navCount: number;
    asideCount: number;
    roleNavigation: number;
    roleMenu: number;
    sidebarCandidates: SidebarCandidate[];
  };
  folders: {
    count: number;
    chats: number;
  };
  settings: Record<string, unknown>;
}

interface PanelLocation {
  parentTag: string;
  parentClassPreview: string;
  parentRect: { x: number; y: number; w: number; h: number };
  parentChildCount: number;
  /** 我们的 panel 在 parent.children 中的索引（0 = 第一个，靠顶） */
  indexInParent: number;
  /** panel 自身可见性 */
  panelVisible: boolean;
  panelRect: { x: number; y: number; w: number; h: number };
}

function getPanelLocation(): PanelLocation | null {
  const panel = document.getElementById('voyager-sidebar-panel');
  if (!panel) return null;
  const parent = panel.parentElement;
  if (!parent) return null;
  const rect = panel.getBoundingClientRect();
  return {
    parentTag: parent.tagName.toLowerCase(),
    parentClassPreview: (parent.className || '').toString().slice(0, 80),
    parentRect: rectOf(parent),
    parentChildCount: parent.children.length,
    indexInParent: Array.from(parent.children).indexOf(panel),
    panelVisible: rect.width > 0 && rect.height > 0,
    panelRect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
  };
}

interface SidebarCandidate {
  selector: string;
  outerHTMLPreview: string;
  rect: { x: number; y: number; w: number; h: number };
  childCount: number;
  scrollable: boolean;
}

function previewHTML(el: HTMLElement, max = 240): string {
  const html = el.outerHTML;
  // 把 class 列表截短一点，可读性更好
  return html.length > max ? html.slice(0, max) + '…' : html;
}

function rectOf(el: HTMLElement): { x: number; y: number; w: number; h: number } {
  const r = el.getBoundingClientRect();
  return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
}

function collectSidebarCandidates(): SidebarCandidate[] {
  const candidates: SidebarCandidate[] = [];

  const push = (el: HTMLElement, selector: string) => {
    if (!el || candidates.find((c) => c.outerHTMLPreview.startsWith(previewHTML(el, 40)))) return;
    const cs = getComputedStyle(el);
    const scrollable = /(auto|scroll|overlay)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight;
    candidates.push({
      selector,
      outerHTMLPreview: previewHTML(el),
      rect: rectOf(el),
      childCount: el.children.length,
      scrollable,
    });
  };

  // 各种候选选择器
  const selectors = [
    'nav',
    'aside',
    '[role="navigation"]',
    '[role="complementary"]',
    '[data-testid*="sidebar" i]',
    '[data-testid*="nav" i]',
    '[class*="sidebar" i]',
    '[class*="Sidebar" i]',
    '[aria-label*="sidebar" i]',
    '[aria-label*="navigation" i]',
    '[aria-label*="侧边栏"]',
    '[aria-label*="导航"]',
  ];
  for (const sel of selectors) {
    document.querySelectorAll<HTMLElement>(sel).forEach((el) => push(el, sel));
  }

  // 含多条 /chat/ 链接的最近祖先
  const chatLinks = document.querySelectorAll<HTMLAnchorElement>('a[href^="/chat/"]');
  if (chatLinks.length >= 2) {
    let cur: HTMLElement | null = chatLinks[0].parentElement;
    while (cur && cur !== document.body) {
      if (Array.from(chatLinks).every((a) => cur!.contains(a))) {
        push(cur, `ancestor-of-${chatLinks.length}-chat-links`);
        break;
      }
      cur = cur.parentElement;
    }
  }
  return candidates;
}

async function makeReport(): Promise<DiagReport> {
  const folders = await loadFolders();
  const settings = await loadSettings();
  const chatLinkEls = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href^="/chat/"]'));
  return {
    version: chrome.runtime.getManifest().version,
    url: location.href,
    pathname: location.pathname,
    voyager: {
      timelineRoot: !!document.getElementById('voyager-timeline-root'),
      timelineEmpty: !!document.getElementById('voyager-timeline-root')?.classList.contains('is-empty'),
      sidebarPanel: !!document.getElementById('voyager-sidebar-panel'),
      panelLocation: getPanelLocation(),
      menuInjector: { observed: true }, // observer 总是开着的
    },
    page: {
      bodyClass: document.body.className,
      hasReactRoot: !!document.getElementById('root'),
      chatLinks: chatLinkEls.length,
      chatLinksSample: chatLinkEls.slice(0, 3).map((a) => ({
        href: a.getAttribute('href') ?? '',
        text: (a.textContent ?? '').slice(0, 40).trim(),
      })),
      navCount: document.querySelectorAll('nav').length,
      asideCount: document.querySelectorAll('aside').length,
      roleNavigation: document.querySelectorAll('[role="navigation"]').length,
      roleMenu: document.querySelectorAll('[role="menu"]').length,
      sidebarCandidates: collectSidebarCandidates(),
    },
    folders: {
      count: folders.folders.length,
      chats: folders.folders.reduce((s, f) => s + f.chats.length, 0),
    },
    settings: settings as unknown as Record<string, unknown>,
  };
}

function highlight(el: HTMLElement, color: string, label: string): void {
  const overlay = document.createElement('div');
  overlay.setAttribute('data-voyager-ui', 'debug');
  const r = el.getBoundingClientRect();
  overlay.style.cssText = `
    position: fixed; top: ${r.top}px; left: ${r.left}px;
    width: ${r.width}px; height: ${r.height}px;
    border: 2px solid ${color}; pointer-events: none;
    z-index: 2147483647; box-sizing: border-box;
    background: ${color}22;
  `;
  const tag = document.createElement('div');
  tag.textContent = label;
  tag.style.cssText = `
    position: absolute; top: -22px; left: 0;
    background: ${color}; color: white; padding: 2px 6px;
    font: 11px/1.2 -apple-system, sans-serif; border-radius: 3px;
  `;
  overlay.appendChild(tag);
  document.body.appendChild(overlay);
  setTimeout(() => overlay.remove(), 4000);
}

const api = {
  /** 打印诊断报告到 console；同时尝试剪贴板（失败则降级为输出纯文本块）。 */
  async diag(): Promise<DiagReport> {
    const r = await makeReport();
    const json = JSON.stringify(r, null, 2);

    // 主输出：纯文本 JSON，方便用户在 console 直接选择并 Cmd+C 复制。
    console.log(
      '%c[Voyager] Diagnostic Report ↓↓↓ 选中下方文本 Cmd/Ctrl+C 复制即可 ↓↓↓',
      'color:#c76946;font-weight:bold',
    );
    console.log(json);
    console.log('%c[Voyager] ↑↑↑ Diagnostic Report 结束 ↑↑↑', 'color:#c76946;font-weight:bold');

    // 顺便给一份结构化输出，方便交互式展开
    console.groupCollapsed('%c[Voyager] (展开看结构化字段)', 'color:#8a8a8a');
    console.log('Voyager state:', r.voyager);
    console.log('Sidebar candidates:', r.page.sidebarCandidates);
    console.log('Panel location:', r.voyager.panelLocation);
    console.log('Folders:', r.folders);
    console.log('Settings:', r.settings);
    console.groupEnd();

    // 剪贴板尽力一试，但 DevTools 在前台时常常拒绝；失败不报错。
    try {
      await navigator.clipboard.writeText(json);
      console.log('%c→ 已写入剪贴板', 'color:#3aa676');
    } catch {
      console.log(
        '%c剪贴板被拒（DevTools 在前台时常发生）；请直接在上方选中 JSON 文本复制。',
        'color:#8a8a8a',
      );
    }
    return r;
  },
  /**
   * 采集当前页面所有「未翻译的英文 UI 文字」，去重后打印成可复制列表。
   * 排除：已在字典里的、我们自己的 UI、对话正文、代码块、纯数字/符号。
   */
  harvest(): string[] {
    const found = new Set<string>();

    const isCovered = (t: string): boolean => {
      if (TEXT_DICT[t] || EXACT_WORDS[t]) return true;
      return PATTERN_REPLACEMENTS.some(({ match }) => match.test(t));
    };

    const looksTranslatable = (raw: string): boolean => {
      const t = raw.trim();
      if (t.length < 1 || t.length > 80) return false;
      if (!/[a-zA-Z]/.test(t)) return false; // 必须含拉丁字母
      if (/^[\d\s.,:;%$+\-/()|]+$/.test(t)) return false; // 纯数字/符号
      // 已经基本是中文的（含较多汉字）就跳过
      const han = (t.match(/[一-鿿]/g) ?? []).length;
      if (han > 0 && han / t.length > 0.3) return false;
      // 跳过明显是 URL / email / 纯大写缩略的代码味
      if (/^https?:\/\//.test(t) || /\S+@\S+\.\S+/.test(t)) return false;
      return true;
    };

    // 判断元素是否处于「不该采集」的区域：我们自己的 UI / 对话正文 / 代码块
    const inExcludedZone = (el: Element): boolean => {
      return !!el.closest(
        '[data-voyager-ui], [data-voyager-skip-i18n], code, pre, ' +
          '[data-testid="user-message"], [data-testid*="message" i], ' +
          '[class*="font-claude" i], [class*="font-user" i]',
      );
    };

    const add = (raw: string | null | undefined) => {
      if (!raw) return;
      const t = raw.trim();
      if (looksTranslatable(t) && !isCovered(t)) found.add(t);
    };

    // 1) 交互/标签型元素的「自身直接文本」
    const controlSel =
      'button, [role="button"], [role="menuitem"], [role="tab"], [role="option"], ' +
      'label, summary, h1, h2, h3, h4, h5, h6, [role="heading"], option';
    document.querySelectorAll<HTMLElement>(controlSel).forEach((el) => {
      if (inExcludedZone(el)) return;
      // 自身直接文本（不含后代），避免把一长串内容吞进来
      let own = '';
      for (const n of Array.from(el.childNodes)) {
        if (n.nodeType === Node.TEXT_NODE) own += n.nodeValue ?? '';
      }
      add(own);
      // 控件如果没有直接文本但整体很短，也收一下整体文本（很多按钮文字嵌在 span 里）
      if (!own.trim()) {
        const whole = (el.textContent ?? '').trim();
        if (whole.length <= 24) add(whole);
      }
    });

    // 2) 属性里的 UI 文字：aria-label / placeholder / title / alt
    document
      .querySelectorAll<HTMLElement>('[aria-label], [placeholder], [title], [alt]')
      .forEach((el) => {
        if (inExcludedZone(el)) return;
        add(el.getAttribute('aria-label'));
        add(el.getAttribute('placeholder'));
        add(el.getAttribute('title'));
        add(el.getAttribute('alt'));
      });

    const list = Array.from(found).sort((a, b) => a.localeCompare(b));
    if (list.length === 0) {
      console.log('%c[Voyager] harvest：当前页没发现未翻译的 UI 文字 ✓', 'color:#3aa676');
      return list;
    }
    console.log(
      `%c[Voyager] harvest 发现 ${list.length} 条未翻译 UI 文字 ↓↓↓ 选中下方 JSON 复制发我 ↓↓↓`,
      'color:#c76946;font-weight:bold',
    );
    // 直接打成「"英文": "",」的字典骨架，我填空即可
    console.log(list.map((s) => `  ${JSON.stringify(s)}: "",`).join('\n'));
    console.log('%c[Voyager] ↑↑↑ harvest 结束 ↑↑↑', 'color:#c76946;font-weight:bold');
    return list;
  },
  /** 打印端上翻译兜底状态（是否启用、是否可用、缓存了多少条）。 */
  mtStatus(): void {
    const s = getMtStatus();
    console.log(
      '%c[Voyager] 端上翻译兜底状态：',
      'color:#c76946;font-weight:bold',
      `\n  启用: ${s.enabled}`,
      `\n  端上 API 可用: ${!s.unavailable}`,
      `\n  已缓存译文: ${s.cached} 条`,
    );
    if (s.unavailable) {
      console.log('  （不可用通常是 Chrome < 138 或非桌面版 / 未下模型；仅靠字典翻译）');
    }
  },
  /** 导出 MT 缓存（自动攒的翻译数据集）为字典骨架，方便折叠进内置字典。 */
  exportCache(): Record<string, string> {
    const c = getCacheSnapshot();
    const keys = Object.keys(c).sort((a, b) => a.localeCompare(b));
    if (keys.length === 0) {
      console.log('%c[Voyager] 缓存为空 —— 还没有端上翻译过的词条', 'color:#8a8a8a');
      return c;
    }
    console.log(
      `%c[Voyager] MT 缓存 ${keys.length} 条 ↓↓↓ 选中复制发我，我筛好折进内置字典 ↓↓↓`,
      'color:#c76946;font-weight:bold',
    );
    console.log(keys.map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(c[k])},`).join('\n'));
    console.log('%c[Voyager] ↑↑↑ MT 缓存结束 ↑↑↑', 'color:#c76946;font-weight:bold');
    return c;
  },
  /** 高亮所有侧边栏候选。 */
  showSidebar(): void {
    const cands = collectSidebarCandidates();
    if (cands.length === 0) {
      console.warn('[Voyager] 没有任何侧边栏候选 — 可能 sidebar 折叠了，请先点开 Claude 侧边栏再试');
      return;
    }
    cands.forEach((_c, i) => {
      const sel = cands[i].selector;
      const el = document.querySelector<HTMLElement>(sel);
      if (el) highlight(el, '#c76946', `候选 ${i + 1}: ${sel}`);
    });
    console.log('[Voyager] 已高亮 sidebar 候选；4 秒后消失。');
    console.table(cands.map((c) => ({ selector: c.selector, rect: `${c.rect.w}×${c.rect.h}`, children: c.childCount })));
  },
  /** 高亮所有 [role="menu"] 元素并打印它们的 menuitem 文本。 */
  showMenus(): void {
    const menus = document.querySelectorAll<HTMLElement>('[role="menu"]');
    if (menus.length === 0) {
      console.warn('[Voyager] 当前页面上没有任何 [role="menu"] —— 请先点开任一对话的三点菜单再调用此命令');
      return;
    }
    menus.forEach((m, i) => {
      highlight(m, '#3aa676', `菜单 ${i + 1}`);
      const items = Array.from(m.querySelectorAll<HTMLElement>('[role="menuitem"], button'))
        .map((el) => (el.textContent ?? '').trim())
        .filter(Boolean);
      console.log(`[Voyager] 菜单 ${i + 1} 的项：`, items);
      console.log(`  outerHTML 预览:`, m.outerHTML.slice(0, 240));
    });
  },
  /** 在当前对话上注册一条假记录，用于测试文件夹面板。 */
  async fakeAdd(name: string = '测试'): Promise<void> {
    const { createFolder, addChatToFolder } = await import('../folders/store');
    const f = await createFolder(name, '#c76946');
    await addChatToFolder(f.id, {
      url: location.pathname,
      title: document.title || '测试对话',
      addedAt: Date.now(),
    });
    console.log('[Voyager] 已创建文件夹"' + name + '"并把当前页面加入');
  },
  /** 诊断时间轴：高亮检测到的用户消息，并打印每条抽取出的文字。 */
  showMessages(): void {
    // 把 detector 用的几个候选选择器逐个 count，方便看哪个命中
    const selectors = [
      '[data-testid="user-message"]',
      '[data-test-render-count][class*="font-user"]',
      '.font-user-message',
      'div[class*="font-user-message"]',
      // 额外探测一些可能的结构
      '[data-testid*="message" i]',
      '[class*="user" i][class*="message" i]',
    ];
    console.log('%c[Voyager] 各候选选择器命中数：', 'color:#c76946;font-weight:bold');
    console.table(
      selectors.map((sel) => ({ selector: sel, count: document.querySelectorAll(sel).length })),
    );

    // 列出页面上所有出现过的 data-testid 值 + 计数 —— 在对话里跑能看出 Claude 用什么标识消息
    const testidCounts = new Map<string, number>();
    document.querySelectorAll<HTMLElement>('[data-testid]').forEach((el) => {
      const id = el.getAttribute('data-testid') ?? '';
      testidCounts.set(id, (testidCounts.get(id) ?? 0) + 1);
    });
    if (testidCounts.size > 0) {
      console.log('%c[Voyager] 页面上所有 data-testid（找含 message/user 的）：', 'color:#c76946');
      console.table(
        Array.from(testidCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([id, count]) => ({ 'data-testid': id, count })),
      );
    } else {
      console.log('[Voyager] 页面上没有任何 data-testid 元素');
    }

    const els = findUserMessageElements();
    if (els.length === 0) {
      console.warn(
        '[Voyager] detector 没找到任何用户消息元素。\n' +
          '若你现在在主页（没打开对话），这是正常的 —— 请打开一条有问答的对话再跑一次。\n' +
          '若你已经在对话里仍是 0，请把上面那张 data-testid 表发我。',
      );
      return;
    }
    console.log(`%c[Voyager] detector 命中 ${els.length} 条，逐条抽取文字：`, 'color:#c76946');
    els.forEach((el, i) => {
      const text = extractCleanText(el);
      console.log(
        `  #${i + 1} 抽取="${text.slice(0, 50)}"${text ? '' : '  ⚠ 空!'} | textContent前40="${(el.textContent ?? '').slice(0, 40).trim()}" | outerHTML前120=${el.outerHTML.slice(0, 120)}`,
      );
      highlight(el, text ? '#3aa676' : '#e8316f', `#${i + 1}${text ? '' : ' 空'}`);
    });
    console.log('[Voyager] 绿框=有文字，红框=抽取为空。4 秒后消失。');
  },
  /** 高亮 Voyager 面板的位置，4 秒后消失。同时滚到视口。 */
  showPanel(): void {
    const panel = document.getElementById('voyager-sidebar-panel');
    if (!panel) {
      console.warn('[Voyager] 没找到 voyager-sidebar-panel —— 面板不存在');
      return;
    }
    panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const rect = panel.getBoundingClientRect();
    console.log(
      `[Voyager] 面板在屏幕坐标 (${Math.round(rect.x)}, ${Math.round(rect.y)})，` +
        `尺寸 ${Math.round(rect.width)}×${Math.round(rect.height)}`,
    );
    highlight(panel, '#e8316f', 'Voyager 面板就在这里');
  },
};

// 同时在 isolated world 挂一份 —— DevTools 选 "content script: content.js" 上下文能直接用。
(window as unknown as { __voyager: typeof api }).__voyager = api;

// 跨 world 桥接：page world 的 public/bridge.js（manifest 用 world:MAIN 注入）会发 'voyager:diag-request'，
// 这里在 isolated world 接住并实际执行（chrome API 只能在 isolated world 用）。
type DiagAction =
  | 'diag'
  | 'harvest'
  | 'exportCache'
  | 'mtStatus'
  | 'showSidebar'
  | 'showMenus'
  | 'showPanel'
  | 'showMessages'
  | 'fakeAdd';
document.addEventListener('voyager:diag-request', (e: Event) => {
  const detail = (e as CustomEvent<{ action: DiagAction; arg?: string }>).detail;
  switch (detail.action) {
    case 'diag':
      void api.diag();
      return;
    case 'harvest':
      api.harvest();
      return;
    case 'exportCache':
      api.exportCache();
      return;
    case 'mtStatus':
      api.mtStatus();
      return;
    case 'showSidebar':
      api.showSidebar();
      return;
    case 'showMenus':
      api.showMenus();
      return;
    case 'showPanel':
      api.showPanel();
      return;
    case 'showMessages':
      api.showMessages();
      return;
    case 'fakeAdd':
      void api.fakeAdd(detail.arg ?? '测试');
      return;
  }
});

export {};
