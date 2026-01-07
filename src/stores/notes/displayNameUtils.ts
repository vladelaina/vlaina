/** Notes Store - Display name management utilities */

import type { NotesStore } from './types';

type SetFn = (fn: (state: NotesStore) => Partial<NotesStore>) => void;

/**
 * Update display name for a note path
 */
export function updateDisplayName(set: SetFn, path: string, name: string): void {
  set((state) => {
    if (state.displayNames.get(path) === name) return {};
    const updatedDisplayNames = new Map(state.displayNames);
    updatedDisplayNames.set(path, name);
    
    // Also update tab name if open
    const updatedTabs = state.openTabs.map(tab => 
      tab.path === path ? { ...tab, name } : tab
    );
    
    return { displayNames: updatedDisplayNames, openTabs: updatedTabs };
  });
}

/**
 * Remove display name for a deleted note
 */
export function removeDisplayName(set: SetFn, path: string): void {
  set((state) => {
    if (!state.displayNames.has(path)) return {};
    const updatedDisplayNames = new Map(state.displayNames);
    updatedDisplayNames.delete(path);
    return { displayNames: updatedDisplayNames };
  });
}

/**
 * Move display name when a note is renamed/moved
 */
export function moveDisplayName(set: SetFn, oldPath: string, newPath: string): void {
  set((state) => {
    const displayName = state.displayNames.get(oldPath);
    if (!displayName && !state.displayNames.has(oldPath)) return {};
    
    const updatedDisplayNames = new Map(state.displayNames);
    updatedDisplayNames.delete(oldPath);
    if (displayName) {
      updatedDisplayNames.set(newPath, displayName);
    }
    return { displayNames: updatedDisplayNames };
  });
}
