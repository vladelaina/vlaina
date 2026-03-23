import { AssetEntry, UploadResult } from '@/lib/assets/types';
import { CustomEmojiSlice } from './slices/customEmojiSlice';

export interface NoteFile {
  id: string;
  name: string;
  path: string;
  isFolder: false;
}

export interface FolderNode {
  id: string;
  name: string;
  path: string;
  isFolder: true;
  children: FileTreeNode[];
  expanded: boolean;
}

export type FileTreeNode = NoteFile | FolderNode;

export interface NoteMetadataEntry {
  icon?: string;
  iconSize?: number;
  cover?: string;
  coverX?: number;
  coverY?: number;
  coverH?: number;
  coverScale?: number;
  createdAt?: number;
  updatedAt?: number;
}

export interface MetadataFile {
  version: number;
  defaultIconSize?: number;
  notes: Record<string, NoteMetadataEntry>;
}

export type StarredKind = 'note' | 'folder';

export interface StarredEntry {
  id: string;
  kind: StarredKind;
  vaultPath: string;
  relativePath: string;
  addedAt: number;
}

export interface PendingStarredNavigation {
  vaultPath: string;
  kind: StarredKind;
  relativePath: string;
  openInNewTab?: boolean;
}

export interface CurrentNoteState {
  path: string;
  content: string;
}

export interface NotesState {
  rootFolder: FolderNode | null;
  currentNote: CurrentNoteState | null;
  notesPath: string;
  isDirty: boolean;
  isLoading: boolean;
  error: string | null;
  recentNotes: string[];
  openTabs: { path: string; name: string; isDirty: boolean }[];
  noteContentsCache: Map<string, string>;
  starredEntries: StarredEntry[];
  starredNotes: string[];
  starredFolders: string[];
  starredLoaded: boolean;
  pendingStarredNavigation: PendingStarredNavigation | null;
  noteMetadata: MetadataFile | null;
  displayNames: Map<string, string>;
  isNewlyCreated: boolean;
  newlyCreatedFolderPath: string | null;
  assetList: AssetEntry[];
  isLoadingAssets: boolean;
  uploadProgress: number | null;
}

export interface NotesActions {
  loadFileTree: () => Promise<void>;
  toggleFolder: (path: string) => void;
  openNote: (path: string, openInNewTab?: boolean) => Promise<void>;
  openNoteByAbsolutePath: (absolutePath: string, openInNewTab?: boolean) => Promise<void>;
  saveNote: () => Promise<void>;
  createNote: (folderPath?: string) => Promise<string>;
  createNoteWithContent: (folderPath: string | undefined, name: string, content: string) => Promise<string>;
  deleteNote: (path: string) => Promise<void>;
  renameNote: (path: string, newName: string) => Promise<void>;
  renameFolder: (path: string, newName: string) => Promise<void>;
  createFolder: (parentPath: string, name?: string) => Promise<string | null>;
  clearNewlyCreatedFolder: () => void;
  deleteFolder: (path: string) => Promise<void>;
  moveItem: (sourcePath: string, targetFolderPath: string) => Promise<void>;
  updateContent: (content: string) => void;
  closeNote: () => void;
  closeTab: (path: string) => Promise<void>;
  switchTab: (path: string) => void;
  reorderTabs: (fromIndex: number, toIndex: number) => void;
  scanAllNotes: () => Promise<void>;
  getBacklinks: (notePath: string) => { path: string; name: string; context: string }[];
  getAllTags: () => { tag: string; count: number }[];
  loadStarred: (vaultPath: string) => Promise<void>;
  loadMetadata: (vaultPath: string) => Promise<void>;
  toggleStarred: (path: string) => void;
  toggleFolderStarred: (path: string) => void;
  removeStarredEntry: (id: string) => void;
  isStarred: (path: string) => boolean;
  isFolderStarred: (path: string) => boolean;
  setPendingStarredNavigation: (navigation: PendingStarredNavigation | null) => void;
  getNoteIcon: (path: string) => string | undefined;
  getNoteIconSize: (path: string) => number | undefined;
  setNoteIcon: (path: string, emoji: string | null) => void;
  setGlobalIconSize: (size: number) => void;
  setNoteIconSize: (path: string, size: number) => void;
  updateAllIconColors: (newColor: string) => void;
  updateAllEmojiSkinTones: (newTone: number) => Promise<void>;
  syncDisplayName: (path: string, title: string) => void;
  getDisplayName: (path: string) => string;
  revealFolder: (path: string) => void;
  uploadNoteAsset: (notePath: string, file: File) => Promise<string | null>;
  getNoteCover: (path: string) => { cover?: string; coverX?: number; coverY?: number; coverH?: number; coverScale?: number };
  setNoteCover: (path: string, cover: string | null, coverX?: number, coverY?: number, coverH?: number, coverScale?: number) => void;
  loadAssets: (vaultPath: string) => Promise<void>;
  uploadAsset: (file: File, category?: 'covers' | 'icons' | 'content', currentNotePath?: string) => Promise<UploadResult>;
  deleteAsset: (filename: string) => Promise<void>;
  cleanupAssetTempFiles: () => Promise<void>;
  getAssetList: (category?: 'covers' | 'icons') => AssetEntry[];
  clearAssetUrlCache: () => void;
}

export type NotesStore = NotesState & NotesActions & CustomEmojiSlice;
