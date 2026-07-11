import { useCallback, useSyncExternalStore } from 'react';
import { normalizeNotePathKey } from '@/lib/notes/displayName';
import { useNotesStore } from '@/stores/useNotesStore';
import { useUIStore } from '@/stores/uiSlice';
import { getStableNoteCoverEntrySnapshot } from '@/components/Notes/features/Cover/noteCoverSnapshot';

export function useDisplayCoverAssetPath(path: string | undefined): string | undefined {
  const normalizedPath = normalizeNotePathKey(path);
  const getCoverSnapshot = useCallback(
    () => getStableNoteCoverEntrySnapshot(path, useNotesStore.getState())?.assetPath,
    [path],
  );
  const getPreviewSnapshot = useCallback(() => {
    if (!path || !normalizedPath) return undefined;
    const state = useUIStore.getState();
    if (!state.universalPreviewTarget) return undefined;
    return normalizeNotePathKey(state.universalPreviewTarget) === normalizedPath
      ? state.universalPreviewCover ?? undefined
      : undefined;
  }, [normalizedPath, path]);

  const cover = useSyncExternalStore(
    useNotesStore.subscribe,
    getCoverSnapshot,
    getCoverSnapshot,
  );
  const previewCover = useSyncExternalStore(
    useUIStore.subscribe,
    getPreviewSnapshot,
    getPreviewSnapshot,
  );

  return previewCover ?? cover;
}
