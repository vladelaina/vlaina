import { useCallback } from 'react';
import { useNotesStore } from '@/stores/useNotesStore';
import { useUIStore } from '@/stores/uiSlice';

export function useDisplayName(path: string | undefined): string | undefined {
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
  if (previewTitle?.path === path) return previewTitle.title;
  return displayName || path.split('/').pop()?.replace('.md', '') || 'Untitled';
}

export function useDisplayIcon(path: string | undefined): string | undefined {
  const noteIcon = useNotesStore(
    useCallback(
      (state) => {
        if (!path) return undefined;
        return state.noteMetadata?.notes[path]?.icon;
      },
      [path]
    )
  );

  const { universalPreviewTarget, universalPreviewIcon } = useUIStore();

  if (!path) return undefined;
  if (universalPreviewTarget === path && universalPreviewIcon) return universalPreviewIcon;
  return noteIcon;
}
