import { useCallback } from 'react';
import { useNotesStore } from '@/stores/useNotesStore';
import { useUIStore } from '@/stores/uiSlice';
import { normalizeNotePathKey, resolveNoteDisplayName } from '@/lib/notes/displayName';

export function useDisplayName(path: string | undefined): string | undefined {
  const normalizedPath = normalizeNotePathKey(path);

  const displayName = useNotesStore(
    useCallback(
      (state) => {
        if (!path) return undefined;
        return state.displayNames.get(path);
      },
      [path]
    )
  );

  const previewTitle = useUIStore(
    useCallback(
      (state) => {
        if (!path) return undefined;
        const previewPath = state.notesPreviewTitle?.path;
        if (!previewPath || !normalizedPath) return undefined;
        return normalizeNotePathKey(previewPath) === normalizedPath ? state.notesPreviewTitle?.title : undefined;
      },
      [normalizedPath, path]
    )
  );

  return resolveNoteDisplayName(path, displayName, previewTitle);
}

export function useDisplayIcon(path: string | undefined): string | undefined {
  const normalizedPath = normalizeNotePathKey(path);

  const noteIcon = useNotesStore(
    useCallback(
      (state) => {
        if (!path) return undefined;
        return state.noteMetadata?.notes[path]?.icon;
      },
      [path]
    )
  );

  const previewIcon = useUIStore(
    useCallback(
      (state) => {
        if (!path) return undefined;
        const previewPath = state.universalPreviewTarget;
        if (!previewPath || !normalizedPath) return undefined;
        return normalizeNotePathKey(previewPath) === normalizedPath ? state.universalPreviewIcon : undefined;
      },
      [normalizedPath, path]
    )
  );

  if (!path) return undefined;
  if (previewIcon) return previewIcon;
  return noteIcon;
}
