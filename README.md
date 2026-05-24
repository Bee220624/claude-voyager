# Claude Voyager

> 一个改善 [claude.ai](https://claude.ai) 网页端使用体验的 Chrome 扩展：右侧时间轴导航、对话文件夹分组、界面中文化。
>
> A Chrome extension that improves the claude.ai web experience: a right-side message timeline, conversation folders, and Simplified-Chinese UI localization.

灵感与功能参考自 [gemini-voyager](https://github.com/Nagi-ovo/gemini-voyager)（GPL-3.0），本项目是面向 Claude 网页端的独立实现。

---

## 功能

| 模块 | 说明 |
| --- | --- |
| **右侧时间轴** | 每条用户提问在右侧生成一个节点。点击平滑滚动到对应消息并高亮；滚动时自动高亮「当前正在看」的节点。 |
| **悬停展开预览** | 节点平时收成一行截断文字；鼠标移到某条上时，文字**就地换行展开**（最多 8 行），不弹独立 tooltip 框。撞车的相似提问一眼可辨。 |
| **固定模式** | 点头部的 📌 把预览常驻展开；再点恢复「悬停才展开」。 |
| **阅读进度** | 顶部水平进度条 + 百分比 + 轨道上的视口滑块，三重展示当前阅读位置。 |
| **消息收藏** | 节点旁的 ★ 标记重要提问，按对话分组持久化。 |
| **文件夹分组** | 在 Claude 原生侧边栏「最近」上方注入文件夹面板。新建 / 重命名 / 换色 / 删除文件夹；**把已有对话加入文件夹**有三条路径：① 悬停对话行点 📁 按钮 ② 把对话拖到文件夹上 ③ 对话三点菜单里的「加入文件夹」。点文件夹内的对话即可跳转。 |
| **界面中文化** | 把按钮、菜单、提示、占位文字、`aria-label` 等替换为简体中文，450+ 词条覆盖侧边栏、模型选择、消息操作、**设置页全部分类**等；正则模式处理「Afternoon, Bee」「Connected 3 days ago」这类半动态文本。可一键开关。 |

每项功能都能在扩展弹窗（工具栏图标）里单独开关。

## 安装

> 需要 **Node 18+**。还没装：`brew install node`，或用 [nvm](https://github.com/nvm-sh/nvm)。

```bash
git clone <your-repo-url> claude-voyager
cd claude-voyager
npm install
npm run build        # 产物输出到 dist/
```

然后在 Chrome 里加载：

1. 打开 `chrome://extensions/`
2. 右上角开启「开发者模式」
3. 点「加载已解压的扩展程序」，选择项目根目录下的 **`dist/`**
4. 打开任意 [claude.ai](https://claude.ai) 页面即可生效；点工具栏图标调开关

开发时用 `npm run dev`（watch 模式），改完代码到扩展页点「重新加载」。

## 设置

| 开关 | 默认 | 作用 |
| --- | --- | --- |
| 启用时间轴 | 开 | 右侧时间轴总开关 |
| 固定预览 | 关 | 预览常驻展开 vs 悬停展开 |
| 显示阅读进度 | 开 | 进度条 / 百分比 / 视口滑块 |
| 启用文件夹面板 | 开 | 侧边栏文件夹分组 |
| 界面中文化 | 开 | 英文 UI → 简体中文 |

数据完全存在本地 `chrome.storage.local`，不联网、不上传：

- `voyager.settings` —— 开关
- `voyager.starred` —— 收藏的消息（按对话 URL 分组）
- `voyager.folders` —— 文件夹与其中的对话

## 技术架构

TypeScript + Vite + Manifest V3，**两份 Vite 配置**：

- `vite.content.config.ts` —— 内容脚本打成单文件 IIFE（MV3 的 content script 不支持 ESM `import`）
- `vite.config.ts` —— popup 走 ESM（HTML 入口）

```
claude-voyager/
├── public/
│   ├── manifest.json        # MV3 清单
│   ├── bridge.js            # page-world 桥，暴露 window.__voyager 诊断 API
│   ├── icons/               # 图标
│   └── _locales/            # Chrome Web Store 元数据用 i18n
├── src/
│   ├── content/index.ts     # 内容脚本入口，按设置启停各模块
│   ├── timeline/            # 时间轴：detector(检测消息/滚动容器) + timeline(渲染/滚动同步/收藏)
│   ├── folders/             # 文件夹：sidebarPanel(注入侧边栏) + chatRowButtons(行内📁) + menuInjector + pickerDialog + store
│   ├── i18n/                # 中文化：translator(扫描替换) + zh-CN(字典)
│   ├── popup/               # 工具栏弹窗（设置开关）
│   ├── storage/             # chrome.storage.local 封装
│   ├── styles/              # CSS
│   └── debug/diag.ts        # 诊断工具（见下）
├── vite.config.ts
└── vite.content.config.ts
```

### 适配 Claude DOM

Claude.ai 是 React SPA，类名不稳定。检测用户消息靠 `src/timeline/detector.ts` 里一组按优先级排列的兜底选择器（命中第一个即用），首选 `[data-testid="user-message"]`。Claude 改版时往列表顶部加新选择器即可，旧的失效但不报错。

文件夹面板靠多策略定位 Claude 侧边栏 + `MutationObserver` 持续接管（侧边栏折叠/重渲都能补回）。

### 中文化字典

`src/i18n/zh-CN.ts` 三张表：

- `TEXT_DICT` —— 完整字符串（短语 / 句子 / 带标点），整段匹配后替换
- `EXACT_WORDS` —— 单词（如 `OK`/`Send`），仅当文本节点整体等于该词才替换，避免误伤句中同名词
- `PATTERN_REPLACEMENTS` —— 正则，处理「下午好，{名字}」「{N} 天前连接」等半动态文本

翻译器在 `MutationObserver` 之外加了**防抖全量重扫**：DOM 活动后 600ms 整页重扫一次，兜住设置页这类 React 异步填充 / 重渲刷回英文的情况。`aria-label`/`placeholder`/`title`/`alt` 也走同一字典。

### 诊断工具

任意 claude.ai 页面打开 DevTools Console，输入 `__voyager.help()` 查看：

- `__voyager.harvest()` —— 采集本页未翻译的英文 UI 文字，输出可直接填的字典骨架
- `__voyager.showMessages()` —— 高亮时间轴检测到的消息并打印抽取文字
- `__voyager.showPanel()` —— 高亮文件夹面板位置
- `__voyager.diag()` —— 打印整体诊断 JSON

## 路线图

- [ ] 多对话批量合并导出为 Markdown / JSON
- [ ] 从 Claude 原生对话列表直接拖拽进文件夹
- [ ] Firefox / Edge 适配

## 致谢与许可

- 功能与交互参考 [gemini-voyager](https://github.com/Nagi-ovo/gemini-voyager) by [@Nagi-ovo](https://github.com/Nagi-ovo)（GPL-3.0）。
- 本项目以 **GPL-3.0** 协议开源，详见 [LICENSE](./LICENSE)。
