import '../styles/timeline.css';
import '../styles/folders.css';
import '../debug/diag'; // 注入 window.__voyager 诊断 API
import { loadSettings, onSettingsChanged, type VoyagerSettings } from '../storage/settings';
import {
  enableTimeline,
  disableTimeline,
  updateTimelineSettings,
} from '../timeline/timeline';
import { enableI18n, disableI18n, isI18nEnabled } from '../i18n/translator';
import { enableFolders, disableFolders } from '../folders';

// 入口：等 DOM 就绪后读取设置，按设置启用模块；之后监听 storage 变化做热更新。

let lastApplied: VoyagerSettings | null = null;

function apply(settings: VoyagerSettings): void {
  // 时间轴
  if (settings.timelineEnabled) {
    if (!lastApplied?.timelineEnabled) enableTimeline(settings);
    else updateTimelineSettings(settings);
  } else if (lastApplied?.timelineEnabled) {
    disableTimeline();
  }

  // 中文化（开关变化时全量启停）
  if (settings.chineseEnabled && !isI18nEnabled()) {
    enableI18n();
  } else if (!settings.chineseEnabled && isI18nEnabled()) {
    disableI18n();
  }

  // 文件夹面板
  if (settings.foldersEnabled && !lastApplied?.foldersEnabled) {
    void enableFolders();
  } else if (!settings.foldersEnabled && lastApplied?.foldersEnabled) {
    disableFolders();
  }

  lastApplied = settings;
}

async function bootstrap(): Promise<void> {
  const settings = await loadSettings();
  apply(settings);
  onSettingsChanged(apply);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => void bootstrap(), { once: true });
} else {
  void bootstrap();
}
