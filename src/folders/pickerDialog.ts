import { loadFolders, addChatToFolder, removeChatFromFolder, createFolder } from './store';
import { FOLDER_COLORS } from './types';

// 弹出对话框：选择把当前对话加入到哪个文件夹（也可新建一个）。
// 单实例：同时只显示一个。

const ROOT_ID = 'voyager-picker-dialog';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function showFolderPicker(chat: { url: string; title: string }): Promise<void> {
  // 关掉旧的
  document.getElementById(ROOT_ID)?.remove();

  const data = await loadFolders();
  const root = document.createElement('div');
  root.id = ROOT_ID;
  root.setAttribute('data-voyager-ui', 'folders');

  const inFolderIds = new Set(
    data.folders.filter((f) => f.chats.some((c) => c.url === chat.url)).map((f) => f.id),
  );

  const items = data.folders
    .map((f) => {
      const checked = inFolderIds.has(f.id);
      return `
      <label class="voyager-picker__item${checked ? ' is-checked' : ''}"
             data-voyager-ui="folders" data-folder-id="${f.id}">
        <input type="checkbox" data-voyager-ui="folders" ${checked ? 'checked' : ''} />
        <span class="voyager-picker__dot" data-voyager-ui="folders" style="background:${f.color ?? '#c76946'}"></span>
        <span class="voyager-picker__name" data-voyager-ui="folders">${escapeHtml(f.name)}</span>
        <span class="voyager-picker__count" data-voyager-ui="folders">${f.chats.length}</span>
      </label>`;
    })
    .join('');

  root.innerHTML = `
    <div class="voyager-picker__backdrop" data-voyager-ui="folders" data-role="close"></div>
    <div class="voyager-picker" data-voyager-ui="folders" role="dialog" aria-modal="true" aria-labelledby="voyager-picker-title">
      <div class="voyager-picker__header" data-voyager-ui="folders">
        <span class="voyager-picker__title" id="voyager-picker-title" data-voyager-ui="folders">加入文件夹</span>
        <button class="voyager-picker__close" type="button" data-voyager-ui="folders" data-role="close" aria-label="关闭">×</button>
      </div>
      <div class="voyager-picker__chat" data-voyager-ui="folders">
        <span data-voyager-ui="folders">当前对话：</span>
        <strong data-voyager-ui="folders" title="${escapeHtml(chat.title)}">${escapeHtml(chat.title)}</strong>
      </div>
      <div class="voyager-picker__list" data-voyager-ui="folders">
        ${items || `<div class="voyager-picker__empty" data-voyager-ui="folders">还没有文件夹，下方先创建一个</div>`}
      </div>
      <div class="voyager-picker__new" data-voyager-ui="folders">
        <input type="text" class="voyager-picker__input" data-voyager-ui="folders" data-role="new-name" placeholder="新文件夹名称..." />
        <button type="button" class="voyager-btn voyager-btn--primary" data-voyager-ui="folders" data-role="new-create">＋ 创建并加入</button>
      </div>
      <div class="voyager-picker__footer" data-voyager-ui="folders">
        <button type="button" class="voyager-btn" data-voyager-ui="folders" data-role="close">完成</button>
      </div>
    </div>
  `;

  document.body.appendChild(root);

  const close = () => root.remove();

  // 关闭
  root.addEventListener('click', (e) => {
    const role = (e.target as HTMLElement).closest<HTMLElement>('[data-role]')?.dataset.role;
    if (role === 'close') close();
  });

  // ESC 关闭
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      close();
      document.removeEventListener('keydown', onKey, true);
    }
  };
  document.addEventListener('keydown', onKey, true);

  // 勾选/取消文件夹
  root.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((cb) => {
    cb.addEventListener('change', async () => {
      const label = cb.closest<HTMLElement>('[data-folder-id]');
      const folderId = label?.dataset.folderId;
      if (!folderId) return;
      if (cb.checked) {
        await addChatToFolder(folderId, { ...chat, addedAt: Date.now() });
        label.classList.add('is-checked');
      } else {
        await removeChatFromFolder(folderId, chat.url);
        label.classList.remove('is-checked');
      }
    });
  });

  // 新建文件夹
  const createBtn = root.querySelector<HTMLButtonElement>('[data-role="new-create"]');
  const nameInput = root.querySelector<HTMLInputElement>('[data-role="new-name"]');
  const doCreate = async () => {
    const name = nameInput?.value.trim();
    if (!name) {
      nameInput?.focus();
      return;
    }
    const data2 = await loadFolders();
    const color = FOLDER_COLORS[data2.folders.length % FOLDER_COLORS.length];
    const folder = await createFolder(name, color);
    await addChatToFolder(folder.id, { ...chat, addedAt: Date.now() });
    close();
  };
  createBtn?.addEventListener('click', doCreate);
  nameInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void doCreate();
    }
  });

  // 自动聚焦
  setTimeout(() => nameInput?.focus(), 50);
}
