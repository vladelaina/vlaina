/**
 * Title Sync Hook - Unified real-time title synchronization
 * 
 * Manages synchronization between:
 * - Editor H1 heading
 * - Tab names
 * - File tree display names
 */

import { useNotesStore } from '@/stores/useNotesStore';

// Cache for preventing duplicate updates
let lastSyncedTitle = '';
let lastSyncedPath = '';

/**
 * Sync title from editor to tabs and file tree
 * Called by ProseMirror plugin on every document change
 */
export function syncTitle(title: string, path: string): void {
  // Skip if nothing changed
  if (title === lastSyncedTitle && path === lastSyncedPath) return;
  
  lastSyncedTitle = title;
  lastSyncedPath = path;
  
  useNotesStore.setState(state => {
    const currentTab = state.openTabs.find(t => t.path === path);
    const currentDisplayName = state.displayNames.get(path);
    
    // Skip update if already in sync
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
 * Reset sync cache (call when switching notes)
 */
export function resetTitleSync(): void {
  lastSyncedTitle = '';
  lastSyncedPath = '';
}

/**
 * Selector: Get display name for a note (from H1 title or file name)
 */
export function selectDisplayName(path: string) {
  return (state: ReturnType<typeof useNotesStore.getState>) => {
    return state.displayNames.get(path) || path.split('/').pop()?.replace('.md', '') || 'Untitled';
  };
}

/**
 * Selector: Get display icon for a note (preview icon or actual icon)
 */
export function selectDisplayIcon(path: string) {
  return (state: ReturnType<typeof useNotesStore.getState>) => {
    if (state.previewIcon?.path === path) return state.previewIcon.icon;
    return state.noteIcons.get(path);
  };
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
