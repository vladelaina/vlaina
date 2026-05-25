import { create } from 'zustand';
import { NotesStore } from './types';
import { createFileSystemSlice } from './slices/fileSystemSlice';
import { createWorkspaceSlice } from './slices/workspaceSlice';
import { createFeatureSlice } from './slices/featureSlice';
import { createAssetSlice } from './slices/assetSlice';
import { NOTE_ICON_SIZE_KEY, RECENT_NOTES_KEY } from './constants';
import { loadGlobalNoteIconSize, loadRecentNotes } from './storage';

export * from './types';
export { sortFileTree } from './fileTreeSorting';
export { setCurrentVaultPath, getCurrentVaultPath } from './storage';

export const useNotesStore = create<NotesStore>()((...a) => ({
  ...createFileSystemSlice(...a),
  ...createWorkspaceSlice(...a),
  ...createFeatureSlice(...a),
  ...createAssetSlice(...a),
}));

let notePreferenceListenerRegistered = false;

function registerNotePreferenceStorageListener(): void {
  if (notePreferenceListenerRegistered || typeof window === 'undefined') {
    return;
  }

  window.addEventListener('storage', (event) => {
    if (event.key === NOTE_ICON_SIZE_KEY) {
      useNotesStore.setState({
        noteIconSize: loadGlobalNoteIconSize(),
      });
      return;
    }

    if (event.key === RECENT_NOTES_KEY) {
      useNotesStore.setState({
        recentNotes: loadRecentNotes(),
      });
    }
  });

  notePreferenceListenerRegistered = true;
}

registerNotePreferenceStorageListener();
