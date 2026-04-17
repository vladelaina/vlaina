import { useCallback, useSyncExternalStore } from 'react';
import { useNotesStore } from '@/stores/useNotesStore';
import { useUIStore } from '@/stores/uiSlice';
import { normalizeNotePathKey, resolveNoteDisplayName } from '@/lib/notes/displayName';
import { resolveDraftNoteTitle } from '@/stores/notes/draftNote';

export function useDisplayName(path: string | undefined): string | undefined {
  const normalizedPath = normalizeNotePathKey(path);

  const getDisplayNameSnapshot = useCallback(() => {
    if (!path) return undefined;
    return useNotesStore.getState().displayNames.get(path);
  }, [path]);

  const getDraftNameSnapshot = useCallback(() => {
    if (!path) return undefined;
    return useNotesStore.getState().draftNotes[path]?.name;
  }, [path]);

  const getPreviewTitleSnapshot = useCallback(() => {
    if (!path) return undefined;
    const previewPath = useUIStore.getState().notesPreviewTitle?.path;
    if (!previewPath || !normalizedPath) return undefined;
    return normalizeNotePathKey(previewPath) === normalizedPath
      ? useUIStore.getState().notesPreviewTitle?.title
      : undefined;
  }, [normalizedPath, path]);

  const displayName = useSyncExternalStore(
    useNotesStore.subscribe,
    getDisplayNameSnapshot,
    getDisplayNameSnapshot,
  );

  const draftName = useSyncExternalStore(
    useNotesStore.subscribe,
    getDraftNameSnapshot,
    getDraftNameSnapshot,
  );

  const previewTitle = useSyncExternalStore(
    useUIStore.subscribe,
    getPreviewTitleSnapshot,
    getPreviewTitleSnapshot,
  );

  if (previewTitle?.trim()) return previewTitle.trim();
  if (draftName !== undefined) return resolveDraftNoteTitle(draftName);

  return resolveNoteDisplayName(path, displayName, previewTitle);
}

export function useDisplayIcon(path: string | undefined): string | undefined {
  const normalizedPath = normalizeNotePathKey(path);

  const getNoteIconSnapshot = useCallback(() => {
    if (!path) return undefined;
    return useNotesStore.getState().noteMetadata?.notes[path]?.icon;
  }, [path]);

  const getPreviewIconSnapshot = useCallback(() => {
    if (!path) return undefined;
    const previewPath = useUIStore.getState().universalPreviewTarget;
    if (!previewPath || !normalizedPath) return undefined;
    return normalizeNotePathKey(previewPath) === normalizedPath
      ? useUIStore.getState().universalPreviewIcon
      : undefined;
  }, [normalizedPath, path]);

  const noteIcon = useSyncExternalStore(
    useNotesStore.subscribe,
    getNoteIconSnapshot,
    getNoteIconSnapshot,
  );

  const previewIcon = useSyncExternalStore(
    useUIStore.subscribe,
    getPreviewIconSnapshot,
    getPreviewIconSnapshot,
  );

  if (!path) return undefined;
  if (previewIcon) return previewIcon;
  return noteIcon;
}
