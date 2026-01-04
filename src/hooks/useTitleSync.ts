/**
 * Title Sync Hooks - React hooks for display name and icon subscriptions
 * 
 * This module provides hooks to subscribe to display names and icons from useNotesStore.
 * The actual state management is handled by useNotesStore internally.
 * 
 * For editor integration, use useNotesStore().syncDisplayName() directly.
 */

import { useNotesStore } from '@/stores/useNotesStore';
import { useUIStore } from '@/stores/uiSlice';

// ============ Hooks ============

/**
 * Hook: Subscribe to display name for a specific note
 * Returns the H1 title if available, otherwise the file name
 */
export function useDisplayName(path: string | undefined): string {
  return useNotesStore(state => {
    if (!path) return 'Untitled';
    return state.displayNames.get(path) || path.split('/').pop()?.replace('.md', '') || 'Untitled';
  });
}

/**
 * Hook: Subscribe to display icon for a specific note
 * Returns preview icon if hovering in IconPicker, otherwise the actual icon
 */
export function useDisplayIcon(path: string | undefined): string | undefined {
  const noteIcon = useNotesStore(state => path ? state.noteIcons.get(path) : undefined);
  const previewIcon = useUIStore(state => state.notesPreviewIcon);
  
  if (!path) return undefined;
  if (previewIcon?.path === path) return previewIcon.icon;
  return noteIcon;
}

// ============ Legacy exports for backward compatibility ============
// These are deprecated - use useNotesStore().syncDisplayName() instead

/**
 * @deprecated Use useNotesStore().syncDisplayName() instead
 */
export function syncTitle(title: string, path: string): void {
  useNotesStore.getState().syncDisplayName(path, title);
}

/**
 * @deprecated No longer needed - state is managed internally
 */
export function resetTitleSync(): void {
  // No-op, kept for backward compatibility
}

/**
 * @deprecated Use useNotesStore().syncDisplayName() instead
 */
export function setDisplayName(path: string, name: string): void {
  useNotesStore.getState().syncDisplayName(path, name);
}

/**
 * @deprecated Handled internally by useNotesStore
 */
export function removeDisplayName(_path: string): void {
  // No-op, handled internally by useNotesStore
}

/**
 * @deprecated Handled internally by useNotesStore
 */
export function moveDisplayName(_oldPath: string, _newPath: string): void {
  // No-op, handled internally by useNotesStore
}

/**
 * @deprecated Use useNotesStore().getDisplayName() instead
 */
export function getDisplayName(path: string): string {
  return useNotesStore.getState().getDisplayName(path);
}
