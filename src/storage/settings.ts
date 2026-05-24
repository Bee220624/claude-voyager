// 用户设置：所有读写都通过 chrome.storage.local 持久化。

export interface VoyagerSettings {
  /** 是否启用右侧时间轴 */
  timelineEnabled: boolean;
  /** 时间轴预览是否「固定」常驻显示（false 时只在悬停时展开） */
  previewPinned: boolean;
  /** 是否显示阅读进度百分比 */
  showProgress: boolean;
  /** 是否启用界面中文化 */
  chineseEnabled: boolean;
  /** 是否启用文件夹分组面板 */
  foldersEnabled: boolean;
}

export const DEFAULT_SETTINGS: VoyagerSettings = {
  timelineEnabled: true,
  previewPinned: false,
  showProgress: true,
  chineseEnabled: true,
  foldersEnabled: true,
};

const STORAGE_KEY = 'voyager.settings';

export async function loadSettings(): Promise<VoyagerSettings> {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  const stored = data[STORAGE_KEY] as Partial<VoyagerSettings> | undefined;
  return { ...DEFAULT_SETTINGS, ...(stored ?? {}) };
}

export async function saveSettings(settings: VoyagerSettings): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: settings });
}

export async function updateSetting<K extends keyof VoyagerSettings>(
  key: K,
  value: VoyagerSettings[K],
): Promise<VoyagerSettings> {
  const current = await loadSettings();
  const next = { ...current, [key]: value };
  await saveSettings(next);
  return next;
}

type Listener = (settings: VoyagerSettings) => void;

/** 监听 chrome.storage 变化并把最新设置回调出来。 */
export function onSettingsChanged(listener: Listener): () => void {
  const handler = (
    changes: { [k: string]: chrome.storage.StorageChange },
    area: chrome.storage.AreaName,
  ) => {
    if (area !== 'local') return;
    if (!(STORAGE_KEY in changes)) return;
    const next = { ...DEFAULT_SETTINGS, ...(changes[STORAGE_KEY].newValue ?? {}) };
    listener(next);
  };
  chrome.storage.onChanged.addListener(handler);
  return () => chrome.storage.onChanged.removeListener(handler);
}
