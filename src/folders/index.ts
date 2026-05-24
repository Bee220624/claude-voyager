import { enableSidebarPanel, disableSidebarPanel } from './sidebarPanel';
import { startMenuInjector, stopMenuInjector } from './menuInjector';
import { startClickTracking, stopClickTracking } from './clickTracker';
import { startChatRowButtons, stopChatRowButtons } from './chatRowButtons';

// 文件夹功能的总入口：
//   - 把面板注入到 Claude 原生侧边栏（sidebarPanel）
//   - 每条对话行上的悬停「📁 加入文件夹」按钮（chatRowButtons，主力、最可靠）
//   - 三点菜单注入「加入文件夹」项（menuInjector，作为补充，命中则锦上添花）
//   - capture-phase click tracking 跟最近点的对话（clickTracker，给 menuInjector 用）

export async function enableFolders(): Promise<void> {
  startClickTracking();
  startMenuInjector();
  startChatRowButtons();
  await enableSidebarPanel();
}

export function disableFolders(): void {
  disableSidebarPanel();
  stopMenuInjector();
  stopClickTracking();
  stopChatRowButtons();
}
