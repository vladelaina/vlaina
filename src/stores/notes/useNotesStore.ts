/** Notes Store - Markdown notes state management */

import { create } from 'zustand';
import { NotesStore } from './types';
import { createFileSystemSlice } from './slices/fileSystemSlice';
import { createWorkspaceSlice } from './slices/workspaceSlice';
import { createFeatureSlice } from './slices/featureSlice';

// Re-export for external use
export * from './types';
export { sortFileTree } from './fileTreeUtils';
export { setCurrentVaultPath, getCurrentVaultPath } from './storage';

export const useNotesStore = create<NotesStore>()((...a) => ({
  ...createFileSystemSlice(...a),
  ...createWorkspaceSlice(...a),
  ...createFeatureSlice(...a),
}));
