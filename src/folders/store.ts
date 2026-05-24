import { FOLDERS_STORAGE_KEY, type FoldersData, type Folder, type FolderChat } from './types';

const DEFAULT: FoldersData = { folders: [] };

export async function loadFolders(): Promise<FoldersData> {
  const data = await chrome.storage.local.get(FOLDERS_STORAGE_KEY);
  const stored = data[FOLDERS_STORAGE_KEY] as FoldersData | undefined;
  if (!stored || !Array.isArray(stored.folders)) return { ...DEFAULT };
  // 规整：保证每个 folder 有 chats 数组
  return {
    folders: stored.folders.map((f) => ({
      ...f,
      chats: Array.isArray(f.chats) ? f.chats : [],
      expanded: f.expanded ?? true,
    })),
  };
}

export async function saveFolders(data: FoldersData): Promise<void> {
  await chrome.storage.local.set({ [FOLDERS_STORAGE_KEY]: data });
}

export async function createFolder(name: string, color?: string): Promise<Folder> {
  const data = await loadFolders();
  const folder: Folder = {
    id: crypto.randomUUID(),
    name,
    color,
    chats: [],
    expanded: true,
  };
  data.folders.push(folder);
  await saveFolders(data);
  return folder;
}

export async function renameFolder(id: string, name: string): Promise<void> {
  const data = await loadFolders();
  const folder = data.folders.find((f) => f.id === id);
  if (!folder) return;
  folder.name = name;
  await saveFolders(data);
}

export async function setFolderColor(id: string, color: string | undefined): Promise<void> {
  const data = await loadFolders();
  const folder = data.folders.find((f) => f.id === id);
  if (!folder) return;
  folder.color = color;
  await saveFolders(data);
}

export async function deleteFolder(id: string): Promise<void> {
  const data = await loadFolders();
  data.folders = data.folders.filter((f) => f.id !== id);
  await saveFolders(data);
}

export async function toggleFolderExpanded(id: string): Promise<void> {
  const data = await loadFolders();
  const folder = data.folders.find((f) => f.id === id);
  if (!folder) return;
  folder.expanded = !folder.expanded;
  await saveFolders(data);
}

export async function addChatToFolder(
  folderId: string,
  chat: FolderChat,
): Promise<void> {
  const data = await loadFolders();
  const folder = data.folders.find((f) => f.id === folderId);
  if (!folder) return;
  // 去重：同一 URL 只保留最新一份
  folder.chats = folder.chats.filter((c) => c.url !== chat.url);
  folder.chats.unshift(chat);
  await saveFolders(data);
}

export async function removeChatFromFolder(folderId: string, url: string): Promise<void> {
  const data = await loadFolders();
  const folder = data.folders.find((f) => f.id === folderId);
  if (!folder) return;
  folder.chats = folder.chats.filter((c) => c.url !== url);
  await saveFolders(data);
}

export async function moveChatToFolder(
  fromFolderId: string,
  toFolderId: string,
  url: string,
): Promise<void> {
  if (fromFolderId === toFolderId) return;
  const data = await loadFolders();
  const from = data.folders.find((f) => f.id === fromFolderId);
  const to = data.folders.find((f) => f.id === toFolderId);
  if (!from || !to) return;
  const idx = from.chats.findIndex((c) => c.url === url);
  if (idx < 0) return;
  const [chat] = from.chats.splice(idx, 1);
  to.chats = to.chats.filter((c) => c.url !== url);
  to.chats.unshift(chat);
  await saveFolders(data);
}

export function findFoldersContaining(data: FoldersData, url: string): Folder[] {
  return data.folders.filter((f) => f.chats.some((c) => c.url === url));
}

export function onFoldersChanged(listener: (data: FoldersData) => void): () => void {
  const handler = (
    changes: { [k: string]: chrome.storage.StorageChange },
    area: chrome.storage.AreaName,
  ) => {
    if (area !== 'local') return;
    if (!(FOLDERS_STORAGE_KEY in changes)) return;
    const next = (changes[FOLDERS_STORAGE_KEY].newValue as FoldersData | undefined) ?? DEFAULT;
    listener({
      folders: next.folders.map((f) => ({
        ...f,
        chats: Array.isArray(f.chats) ? f.chats : [],
        expanded: f.expanded ?? true,
      })),
    });
  };
  chrome.storage.onChanged.addListener(handler);
  return () => chrome.storage.onChanged.removeListener(handler);
}
