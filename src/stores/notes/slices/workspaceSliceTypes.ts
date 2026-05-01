import type { StoreApi } from 'zustand';
import type { NotesStore } from '../types';

export interface WorkspaceSlice {
  currentNote: NotesStore['currentNote'];
  currentNoteRevision: NotesStore['currentNoteRevision'];
  currentNoteDiskRevision: NotesStore['currentNoteDiskRevision'];
  isDirty: NotesStore['isDirty'];
  isLoading: NotesStore['isLoading'];
  error: NotesStore['error'];
  openTabs: NotesStore['openTabs'];
  recentlyClosedTabs: NotesStore['recentlyClosedTabs'];
  draftNotes: NotesStore['draftNotes'];
  pendingDraftDiscardPath: NotesStore['pendingDraftDiscardPath'];
  displayNames: NotesStore['displayNames'];

  openNote: (path: string, openInNewTab?: boolean) => Promise<void>;
  openNoteByAbsolutePath: (absolutePath: string, openInNewTab?: boolean) => Promise<void>;
  prefetchNote: NotesStore['prefetchNote'];
  adoptAbsoluteNoteIntoVault: (absolutePath: string, nextPath: string) => boolean;
  saveNote: NotesStore['saveNote'];
  syncCurrentNoteFromDisk: NotesStore['syncCurrentNoteFromDisk'];
  invalidateNoteCache: NotesStore['invalidateNoteCache'];
  applyExternalPathRename: NotesStore['applyExternalPathRename'];
  applyExternalPathDeletion: NotesStore['applyExternalPathDeletion'];
  updateContent: (content: string) => void;
  updateDraftNoteName: (path: string, name: string) => void;
  discardDraftNote: (path: string) => void;
  cancelPendingDraftDiscard: () => void;
  confirmPendingDraftDiscard: () => Promise<void>;
  closeNote: () => void;
  closeTab: (path: string) => Promise<void>;
  reopenClosedTab: () => Promise<void>;
  switchTab: (path: string) => void;
  reorderTabs: (fromIndex: number, toIndex: number) => void;
  syncDisplayName: (path: string, title: string) => void;
  getDisplayName: (path: string) => string;
}

export type NotesSet = StoreApi<NotesStore>['setState'];
export type NotesGet = StoreApi<NotesStore>['getState'];
