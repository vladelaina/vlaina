import type { NotesStore } from '../types';

export interface FileSystemSlice {
  rootFolder: NotesStore['rootFolder'];
  notesPath: NotesStore['notesPath'];
  isNewlyCreated: NotesStore['isNewlyCreated'];
  newlyCreatedFolderPath: NotesStore['newlyCreatedFolderPath'];
  fileTreeSortMode: NotesStore['fileTreeSortMode'];

  loadFileTree: (skipRestore?: boolean) => Promise<void>;
  toggleFolder: (path: string) => void;
  revealFolder: (path: string) => void;
  createNote: (folderPath?: string) => Promise<string>;
  createNoteWithContent: (
    folderPath: string | undefined,
    name: string,
    content: string,
  ) => Promise<string>;
  deleteNote: (path: string) => Promise<void>;
  renameNote: (path: string, newName: string) => Promise<void>;
  renameFolder: (path: string, newName: string) => Promise<void>;
  createFolder: (parentPath: string, name?: string) => Promise<string | null>;
  clearNewlyCreatedFolder: () => void;
  deleteFolder: (path: string) => Promise<void>;
  moveItem: (sourcePath: string, targetFolderPath: string) => Promise<void>;
  setFileTreeSortMode: NotesStore['setFileTreeSortMode'];
}

export const fileSystemSliceInitialState = {
  rootFolder: null,
  notesPath: '',
  isNewlyCreated: false,
  newlyCreatedFolderPath: null,
  fileTreeSortMode: 'name-asc' as const,
};

export type FileSystemSliceSet = (
  partial: Partial<NotesStore> | ((state: NotesStore) => Partial<NotesStore>),
) => void;

export type FileSystemSliceGet = () => NotesStore;
