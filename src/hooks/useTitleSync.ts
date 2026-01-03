/**
 * Title Sync - Unified real-time title synchronization
 * 
 * Single source of truth for managing display names across:
 * - Editor H1 heading
 * - Tab names  
 * - File tree display names
 * 
 * All displayNames operations should go through this module.
 */

import { useNotesStore } from '@/stores/useNotesStore';

// ============ Cache ============

let lastSyncedTitle = '';
let lastSyncedPath = '';

// ============ Core Operations ============

/**
 * Sync title from editor to tabs and file tree (real-time)
 */
export function syncTitle(title: string, path: string): void {
  if (title === lastSyncedTitle && path === lastSyncedPath) return;
  
  lastSyncedTitle = title;
  lastSyncedPath = path;
  
  useNotesStore.setState(state => {
    const currentTab = state.openTabs.find(t => t.path === path);
    const currentDisplayName = state.displayNames.get(path);
    
    if (currentTab?.name === title && currentDisplayName === title) {
      return {};
    }
    
    const updatedTabs = currentTab?.name !== title
      ? state.openTabs.map(tab => tab.path === path ? { ...tab, name: title } : tab)
      : state.openTabs;
      
    const updatedDisplayNames = currentDisplayName !== title
      ? new Map(state.displayNames).set(path, title)
      : state.displayNames;
    
    return { openTabs: updatedTabs, displayNames: updatedDisplayNames };
  });
}

/**
 * Set display name for a path (used when opening notes)
 */
export function setDisplayName(path: string, name: string): void {
  useNotesStore.setState(state => {
    if (state.displayNames.get(path) === name) return {};
    const updatedDisplayNames = new Map(state.displayNames);
    updatedDisplayNames.set(path, name);
    return { displayNames: updatedDisplayNames };
  });
}

/**
 * Remove display name for a path (used when deleting notes)
 */
export function removeDisplayName(path: string): void {
  useNotesStore.setState(state => {
    if (!state.displayNames.has(path)) return {};
    const updatedDisplayNames = new Map(state.displayNames);
    updatedDisplayNames.delete(path);
    return { displayNames: updatedDisplayNames };
  });
}

/**
 * Move display name from old path to new path (used when renaming/moving)
 */
export function moveDisplayName(oldPath: string, newPath: string): void {
  useNotesStore.setState(state => {
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

/**
 * Reset sync cache (call when switching notes)
 */
export function resetTitleSync(): void {
  lastSyncedTitle = '';
  lastSyncedPath = '';
}

// ============ Selectors & Hooks ============

/**
 * Get display name for a note (from H1 title or file name)
 */
export function getDisplayName(path: string): string {
  const state = useNotesStore.getState();
  return state.displayNames.get(path) || path.split('/').pop()?.replace('.md', '') || 'Untitled';
}

/**
 * Hook: Subscribe to display name for a specific note
 */
export function useDisplayName(path: string | undefined): string {
  return useNotesStore(state => {
    if (!path) return 'Untitled';
    return state.displayNames.get(path) || path.split('/').pop()?.replace('.md', '') || 'Untitled';
  });
}

/**
 * Hook: Subscribe to display icon for a specific note
 */
export function useDisplayIcon(path: string | undefined): string | undefined {
  return useNotesStore(state => {
    if (!path) return undefined;
    if (state.previewIcon?.path === path) return state.previewIcon.icon;
    return state.noteIcons.get(path);
  });
}
