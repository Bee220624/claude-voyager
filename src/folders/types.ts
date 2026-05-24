export interface FolderChat {
  /** 对话 URL，例如 /chat/123e4567-... */
  url: string;
  /** 对话标题（加入文件夹时从页面 title/header 抓取的快照） */
  title: string;
  /** 加入时间戳 ms */
  addedAt: number;
}

export interface Folder {
  id: string;
  name: string;
  /** 文件夹颜色，CSS 颜色字符串。可选。 */
  color?: string;
  chats: FolderChat[];
  /** 是否展开 */
  expanded?: boolean;
}

export interface FoldersData {
  folders: Folder[];
}

export const FOLDERS_STORAGE_KEY = 'voyager.folders';

export const FOLDER_COLORS = [
  '#c76946', // accent
  '#5b8def',
  '#3aa676',
  '#a374d5',
  '#d5a13a',
  '#d57474',
  '#5fb2c7',
] as const;
