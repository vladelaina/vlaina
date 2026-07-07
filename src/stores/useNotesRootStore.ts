import { create } from 'zustand';
import {
  NOTES_ROOTS_STORAGE_KEY,
  isOversizedRecentNotesRootsStorageValue,
  parseRecentNotesRootsStorageValue,
} from './notesRootStoreSupport';
import { createNotesRootLifecycleActions } from './notesRootStoreLifecycle';
import { createNotesRootMutationActions } from './notesRootStoreMutations';
import type { NotesRootStore, NotesRootInfo } from './notesRootStoreTypes';

export type { NotesRootInfo };

export const useNotesRootStore = create<NotesRootStore>()((set, get) => ({
  currentNotesRoot: null,
  recentNotesRoots: [],
  isLoading: false,
  hasInitialized: false,
  error: null,
  ...createNotesRootLifecycleActions(set, get),
  ...createNotesRootMutationActions(set, get),
}));

let notesRootStorageListenerRegistered = false;

function registerNotesRootStorageListener(): void {
  if (notesRootStorageListenerRegistered || typeof window === 'undefined') {
    return;
  }

  window.addEventListener('storage', (event) => {
    if (event.key !== NOTES_ROOTS_STORAGE_KEY) {
      return;
    }

    if (isOversizedRecentNotesRootsStorageValue(event.newValue)) {
      return;
    }

    const recentNotesRoots = parseRecentNotesRootsStorageValue(event.newValue);
    const currentNotesRoot = useNotesRootStore.getState().currentNotesRoot;
    const refreshedCurrentNotesRoot = currentNotesRoot
      ? recentNotesRoots.find((notesRoot) => notesRoot.id === currentNotesRoot.id) ?? currentNotesRoot
      : null;

    useNotesRootStore.setState({
      recentNotesRoots,
      currentNotesRoot: refreshedCurrentNotesRoot,
    });
  });

  notesRootStorageListenerRegistered = true;
}

registerNotesRootStorageListener();
