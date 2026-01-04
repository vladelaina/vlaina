/** Title Sync Hooks - React hooks for display name and icon subscriptions */

import { useNotesStore } from '@/stores/useNotesStore';
import { useUIStore } from '@/stores/uiSlice';

export function useDisplayName(path: string | undefined): string {
  return useNotesStore(state => {
    if (!path) return 'Untitled';
    return state.displayNames.get(path) || path.split('/').pop()?.replace('.md', '') || 'Untitled';
  });
}

export function useDisplayIcon(path: string | undefined): string | undefined {
  const noteIcon = useNotesStore(state => path ? state.noteIcons.get(path) : undefined);
  const previewIcon = useUIStore(state => state.notesPreviewIcon);
  
  if (!path) return undefined;
  if (previewIcon?.path === path) return previewIcon.icon;
  return noteIcon;
}

/** @deprecated Use useNotesStore().syncDisplayName() instead */
export function syncTitle(title: string, path: string): void {
  useNotesStore.getState().syncDisplayName(path, title);
}

/** @deprecated No longer needed - state is managed internally */
export function resetTitleSync(): void {
}

/** @deprecated Use useNotesStore().syncDisplayName() instead */
export function setDisplayName(path: string, name: string): void {
  useNotesStore.getState().syncDisplayName(path, name);
}

/** @deprecated Handled internally by useNotesStore */
export function removeDisplayName(_path: string): void {
}

/** @deprecated Handled internally by useNotesStore */
export function moveDisplayName(_oldPath: string, _newPath: string): void {
}

/** @deprecated Use useNotesStore().getDisplayName() instead */
export function getDisplayName(path: string): string {
  return useNotesStore.getState().getDisplayName(path);
}
