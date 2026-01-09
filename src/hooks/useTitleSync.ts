/** Title Sync Hooks - React hooks for display name and icon subscriptions */

import { useNotesStore } from '@/stores/useNotesStore';
import { useUIStore } from '@/stores/uiSlice';

export function useDisplayName(path: string | undefined): string | undefined {
  const displayName = useNotesStore(state => {
    if (!path) return undefined;
    return state.displayNames.get(path) || path.split('/').pop()?.replace('.md', '') || 'Untitled';
  });
  const previewTitle = useUIStore(state => state.notesPreviewTitle);
  
  if (!path) return undefined;
  // If there's a preview title for this path, use it
  if (previewTitle?.path === path) return previewTitle.title;
  return displayName;
}

export function useDisplayIcon(path: string | undefined): string | undefined {
  const noteIcon = useNotesStore(state => path ? state.noteIcons.get(path) : undefined);
  const previewIcon = useUIStore(state => state.notesPreviewIcon);
  
  if (!path) return undefined;
  if (previewIcon?.path === path) return previewIcon.icon;
  return noteIcon;
}
