/** Notes Store - Type definitions */

import { AssetIndex, AssetEntry, UploadResult } from '@/lib/assets/types';

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

// Unified Metadata Types
export interface NoteMetadataEntry {
  icon?: string;
  cover?: string;
  coverY?: number;
}

export interface MetadataFile {
  version: number;
  notes: Record<string, NoteMetadataEntry>;
}

export interface NotesState {
  rootFolder: FolderNode | null;
  currentNote: { path: string; content: string } | null;
  notesPath: string;
  isDirty: boolean;
  isLoading: boolean;
  error: string | null;
  recentNotes: string[];
  openTabs: { path: string; name: string; isDirty: boolean }[];
  noteContentsCache: Map<string, string>;
  starredNotes: string[];
  starredFolders: string[];
  favoritesLoaded: boolean;
  noteMetadata: MetadataFile | null;
  displayNames: Map<string, string>;
  isNewlyCreated: boolean;
  newlyCreatedFolderPath: string | null;
  // Asset library state
  assetIndex: AssetIndex | null;
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
  loadFavorites: (vaultPath: string) => Promise<void>;
  loadMetadata: (vaultPath: string) => Promise<void>;
  toggleStarred: (path: string) => void;
  toggleFolderStarred: (path: string) => void;
  isStarred: (path: string) => boolean;
  isFolderStarred: (path: string) => boolean;
  getNoteIcon: (path: string) => string | undefined;
  setNoteIcon: (path: string, emoji: string | null) => void;
  updateAllIconColors: (newColor: string) => void;
  updateAllEmojiSkinTones: (newTone: number) => void;
  syncDisplayName: (path: string, title: string) => void;
  getDisplayName: (path: string) => string;
  uploadNoteAsset: (notePath: string, file: File) => Promise<string | null>;
  // Cover metadata
  getNoteCover: (path: string) => { cover?: string; coverY?: number };
  setNoteCover: (path: string, cover: string | null, coverY?: number) => void;
  // Asset library actions
  loadAssetIndex: (vaultPath: string) => Promise<void>;
  uploadAsset: (file: File) => Promise<UploadResult>;
  deleteAsset: (filename: string) => Promise<void>;
  getUnusedAssets: () => Promise<string[]>;
  cleanUnusedAssets: () => Promise<number>;
  cleanupAssetTempFiles: () => Promise<void>;
  getAssetList: () => AssetEntry[];
}

export type NotesStore = NotesState & NotesActions;
