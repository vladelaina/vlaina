/** Notes Store - Type definitions */

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
  noteIcons: Map<string, string>;
  displayNames: Map<string, string>;
  isNewlyCreated: boolean;
  newlyCreatedFolderPath: string | null;
}

export interface NotesActions {
  loadFileTree: (silent?: boolean) => Promise<void>;
  toggleFolder: (path: string) => void;
  openNote: (path: string, openInNewTab?: boolean) => Promise<void>;
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
  loadNoteIcons: (vaultPath: string) => Promise<void>;
  toggleStarred: (path: string) => void;
  toggleFolderStarred: (path: string) => void;
  isStarred: (path: string) => boolean;
  isFolderStarred: (path: string) => boolean;
  getNoteIcon: (path: string) => string | undefined;
  setNoteIcon: (path: string, emoji: string | null) => void;
  syncDisplayName: (path: string, title: string) => void;
  getDisplayName: (path: string) => string;
}

export type NotesStore = NotesState & NotesActions;
