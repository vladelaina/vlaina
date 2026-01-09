/** Title Sync Hooks - React hooks for display name and icon subscriptions */

import { useCallback } from 'react';
import { useNotesStore } from '@/stores/useNotesStore';
import { useUIStore } from '@/stores/uiSlice';

export function useDisplayName(path: string | undefined): string | undefined {
  // Use shallow equality for Map.get - Zustand handles this correctly
  const displayName = useNotesStore(
    useCallback(
      (state) => {
        if (!path) return undefined;
        return state.displayNames.get(path);
      },
      [path]
    )
  );
  
  const previewTitle = useUIStore((state) => state.notesPreviewTitle);

  if (!path) return undefined;
  // Preview takes priority
  if (previewTitle?.path === path) return previewTitle.title;
  // Fall back to displayName or derive from path
  return displayName || path.split('/').pop()?.replace('.md', '') || 'Untitled';
}

export function useDisplayIcon(path: string | undefined): string | undefined {
  const noteIcon = useNotesStore(
    useCallback(
      (state) => (path ? state.noteIcons.get(path) : undefined),
      [path]
    )
  );
  const previewIcon = useUIStore((state) => state.notesPreviewIcon);

  if (!path) return undefined;
  if (previewIcon?.path === path) return previewIcon.icon;
  return noteIcon;
}
