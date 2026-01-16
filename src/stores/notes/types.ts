/** Notes Store - Type definitions */

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

// Unified Metadata Types
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
  loadFavorites: (vaultPath: string) => Promise<void>;
  loadMetadata: (vaultPath: string) => Promise<void>;
  toggleStarred: (path: string) => void;
  toggleFolderStarred: (path: string) => void;
  isStarred: (path: string) => boolean;
  isFolderStarred: (path: string) => boolean;
  getNoteIcon: (path: string) => string | undefined;
  getNoteIconSize: (path: string) => number | undefined;
  setNoteIcon: (path: string, emoji: string | null) => void;
  // Per-note size is deprecated in favor of global, but keeping for backward compat if needed, 
  // or we can reuse this name for the global action if we want to simplify.
  // actually, let's keep setNoteIconSize for specific overrides if we ever want them, 
  // but for now the requirement is GLOBAL.
  // Let's add a specific global action to be clear.
  setGlobalIconSize: (size: number) => void;
  setNoteIconSize: (path: string, size: number) => void;
  updateAllIconColors: (newColor: string) => void;
  updateAllEmojiSkinTones: (newTone: number) => void;
  syncDisplayName: (path: string, title: string) => void;
  getDisplayName: (path: string) => string;
  uploadNoteAsset: (notePath: string, file: File) => Promise<string | null>;
  // Cover metadata
  getNoteCover: (path: string) => { cover?: string; coverX?: number; coverY?: number; coverH?: number; coverScale?: number };
  setNoteCover: (path: string, cover: string | null, coverX?: number, coverY?: number, coverH?: number, coverScale?: number) => void;
  // Asset library actions
  loadAssets: (vaultPath: string) => Promise<void>;
  uploadAsset: (file: File, category?: 'covers' | 'icons') => Promise<UploadResult>;
  deleteAsset: (filename: string) => Promise<void>;
  cleanupAssetTempFiles: () => Promise<void>;
  getAssetList: (category?: 'covers' | 'icons') => AssetEntry[];
  clearAssetUrlCache: () => void;
}

export type NotesStore = NotesState & NotesActions & CustomEmojiSlice;
