import {
  loadSettings,
  updateSetting,
  type VoyagerSettings,
} from '../storage/settings';

const FIELDS: (keyof VoyagerSettings)[] = [
  'timelineEnabled',
  'previewPinned',
  'showProgress',
  'foldersEnabled',
  'chineseEnabled',
];

function $(id: string): HTMLInputElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} not found`);
  return el as HTMLInputElement;
}

function flashSaved(): void {
  const status = document.getElementById('status');
  if (!status) return;
  status.classList.add('is-saved');
  status.textContent = '已保存 ✓';
  window.setTimeout(() => {
    status.classList.remove('is-saved');
    status.textContent = '设置已自动保存';
  }, 900);
}

async function init(): Promise<void> {
  const versionEl = document.getElementById('version');
  if (versionEl) {
    versionEl.textContent = `v${chrome.runtime.getManifest().version}`;
  }

  const settings = await loadSettings();
  for (const f of FIELDS) {
    const input = $(f);
    input.checked = settings[f];
    input.addEventListener('change', () => {
      void updateSetting(f, input.checked).then(flashSaved);
    });
  }
}

void init();
