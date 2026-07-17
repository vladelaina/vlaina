import type { StoreApi } from 'zustand';
import type { NotesStore } from '../types';

export interface WorkspaceSlice {
  currentNote: NotesStore['currentNote'];
  currentNoteRevision: NotesStore['currentNoteRevision'];
  currentNoteDiskRevision: NotesStore['currentNoteDiskRevision'];
  workspaceRestoredNote: NotesStore['workspaceRestoredNote'];
  isDirty: NotesStore['isDirty'];
  isLoading: NotesStore['isLoading'];
  error: NotesStore['error'];
  saveError: NotesStore['saveError'];
  saveErrorPath: NotesStore['saveErrorPath'];
  openTabs: NotesStore['openTabs'];
  recentlyClosedTabs: NotesStore['recentlyClosedTabs'];
  noteNavigationHistory: NotesStore['noteNavigationHistory'];
  noteNavigationHistoryIndex: NotesStore['noteNavigationHistoryIndex'];
  draftNotes: NotesStore['draftNotes'];
  pendingDraftDiscardPath: NotesStore['pendingDraftDiscardPath'];
  displayNames: NotesStore['displayNames'];

  openNote: NotesStore['openNote'];
  openNoteByAbsolutePath: NotesStore['openNoteByAbsolutePath'];
  prefetchNote: NotesStore['prefetchNote'];
  cancelPrefetchNote: NotesStore['cancelPrefetchNote'];
  adoptAbsoluteNoteIntoNotesRoot: (absolutePath: string, nextPath: string) => boolean;
  saveNote: NotesStore['saveNote'];
  syncCurrentNoteFromDisk: NotesStore['syncCurrentNoteFromDisk'];
  invalidateNoteCache: NotesStore['invalidateNoteCache'];
  applyExternalPathRename: NotesStore['applyExternalPathRename'];
  applyExternalPathDeletion: NotesStore['applyExternalPathDeletion'];
  updateContent: (content: string) => void;
  updateDraftNoteName: (path: string, name: string) => void;
  discardDraftNote: NotesStore['discardDraftNote'];
  cancelPendingDraftDiscard: () => void;
  confirmPendingDraftDiscard: () => Promise<void>;
  closeNote: () => Promise<void>;
  closeTab: (path: string) => Promise<void>;
  reopenClosedTab: () => Promise<void>;
  navigateBackInNoteHistory: NotesStore['navigateBackInNoteHistory'];
  navigateForwardInNoteHistory: NotesStore['navigateForwardInNoteHistory'];
  switchTab: (path: string) => void;
  reorderTabs: (fromIndex: number, toIndex: number) => void;
  syncDisplayName: (path: string, title: string) => void;
  getDisplayName: (path: string) => string;
}

export type NotesSet = StoreApi<NotesStore>['setState'];
export type NotesGet = StoreApi<NotesStore>['getState'];
