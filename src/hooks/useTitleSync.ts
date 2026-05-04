import { useCallback, useSyncExternalStore } from 'react';
import { useNotesStore } from '@/stores/useNotesStore';
import { useUIStore } from '@/stores/uiSlice';
import { normalizeNotePathKey, resolveNoteDisplayName } from '@/lib/notes/displayName';
import { isDraftNotePath, resolveDraftNoteTitle } from '@/stores/notes/draftNote';

const TITLE_SNAPSHOT_SEPARATOR = '\u001f';

function encodeTitleSnapshot(
  displayName: string | undefined,
  draftName: string | undefined,
  hasDraft: boolean,
): string {
  return [
    displayName ?? '',
    hasDraft ? '1' : '0',
    draftName ?? '',
  ].join(TITLE_SNAPSHOT_SEPARATOR);
}

function decodeTitleSnapshot(snapshot: string): {
  displayName: string | undefined;
  draftName: string | undefined;
} {
  const [displayName = '', draftMarker = '0', draftName = ''] = snapshot.split(TITLE_SNAPSHOT_SEPARATOR);
  return {
    displayName: displayName || undefined,
    draftName: draftMarker === '1' ? draftName : undefined,
  };
}

export function useDisplayName(path: string | undefined): string | undefined {
  const normalizedPath = normalizeNotePathKey(path);

  const getNotesTitleSnapshot = useCallback(() => {
    if (!path) return encodeTitleSnapshot(undefined, undefined, false);
    const notesState = useNotesStore.getState();
    const draftNote = notesState.draftNotes[path];
    return encodeTitleSnapshot(
      notesState.displayNames.get(path),
      draftNote?.name,
      draftNote !== undefined,
    );
  }, [path]);

  const getPreviewTitleSnapshot = useCallback(() => {
    if (!path) return undefined;
    const previewPath = useUIStore.getState().notesPreviewTitle?.path;
    if (!previewPath || !normalizedPath) return undefined;
    return normalizeNotePathKey(previewPath) === normalizedPath
      ? useUIStore.getState().notesPreviewTitle?.title
      : undefined;
  }, [normalizedPath, path]);

  const notesTitleSnapshot = useSyncExternalStore(
    useNotesStore.subscribe,
    getNotesTitleSnapshot,
    getNotesTitleSnapshot,
  );

  const previewTitle = useSyncExternalStore(
    useUIStore.subscribe,
    getPreviewTitleSnapshot,
    getPreviewTitleSnapshot,
  );

  const { displayName, draftName } = decodeTitleSnapshot(notesTitleSnapshot);

  if (previewTitle?.trim()) return previewTitle.trim();
  if (draftName !== undefined) return resolveDraftNoteTitle(draftName);
  if (isDraftNotePath(path)) return resolveDraftNoteTitle(undefined);

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
