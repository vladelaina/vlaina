export interface NotesRootInfo {
  id: string;
  name: string;
  path: string;
  lastOpened: number;
}

export interface NotesRootState {
  currentNotesRoot: NotesRootInfo | null;
  recentNotesRoots: NotesRootInfo[];
  isLoading: boolean;
  hasInitialized: boolean;
  error: string | null;
}

export interface NotesRootActions {
  initialize: () => Promise<void>;
  openNotesRoot: (path: string, name?: string, options?: { preserveSidebarTree?: boolean }) => Promise<boolean>;
  createNotesRoot: (name: string, path: string) => Promise<boolean>;
  renameCurrentNotesRoot: (name: string) => Promise<boolean>;
  syncCurrentNotesRootExternalPath: (path: string) => void;
  removeFromRecent: (id: string) => Promise<boolean>;
  closeNotesRoot: () => Promise<boolean>;
  clearError: () => void;
  checkNotesRootOpenInOtherWindow: (path: string) => Promise<string | null>;
}

export type NotesRootStore = NotesRootState & NotesRootActions;
export type NotesRootStoreSet = (state: Partial<NotesRootStore>) => void;
export type NotesRootStoreGet = () => NotesRootStore;
