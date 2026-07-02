import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNotesStore } from '@/stores/useNotesStore';
import { resolveEffectiveNotesRootPath } from '@/stores/notes/effectiveNotesRootPath';
import { readNoteMetadataFromMarkdown } from '@/stores/notes/frontmatter';
import { notifyNotesOverlayOpen, onNotesOverlayOpen } from '@/components/Notes/features/overlays/notesOverlayEvents';
import type { NoteCoverMetadata, NotesStore } from '@/stores/notes/types';
import type { NoteCoverController } from '../types';

const COVER_SNAPSHOT_SEPARATOR = '\u001f';
const coverSnapshotCache = new Map<string, NoteCoverMetadata>();

function getCoverSnapshotCacheKey(notesPath: string | undefined, path: string): string {
  return [
    notesPath ?? '',
    path,
  ].join(COVER_SNAPSHOT_SEPARATOR);
}

function coverEntriesEqual(
  first: NoteCoverMetadata | undefined,
  second: NoteCoverMetadata | undefined,
): boolean {
  return (
    first?.assetPath === second?.assetPath &&
    first?.positionX === second?.positionX &&
    first?.positionY === second?.positionY &&
    first?.height === second?.height &&
    first?.scale === second?.scale
  );
}

function getStableCachedCoverEntry(
  cacheKey: string,
  cover: NoteCoverMetadata | undefined,
): NoteCoverMetadata | undefined {
  if (!cover?.assetPath) {
    coverSnapshotCache.delete(cacheKey);
    return undefined;
  }

  const previous = coverSnapshotCache.get(cacheKey);
  if (coverEntriesEqual(previous, cover)) {
    return previous;
  }

  const next = { ...cover };
  coverSnapshotCache.set(cacheKey, next);
  return next;
}

export function clearNoteCoverSnapshotCacheForTests(): void {
  coverSnapshotCache.clear();
}

export function getStableNoteCoverEntrySnapshot(
  path: string | undefined,
  state: Pick<NotesStore, 'currentNote' | 'noteMetadata' | 'notesPath'>,
): NoteCoverMetadata | undefined {
  if (!path) return undefined;

  const cacheKey = getCoverSnapshotCacheKey(state.notesPath, path);
  const notes = state.noteMetadata?.notes;
  if (notes && Object.prototype.hasOwnProperty.call(notes, path)) {
    return getStableCachedCoverEntry(cacheKey, notes[path]?.cover);
  }

  if (state.currentNote?.path === path) {
    const cover = readNoteMetadataFromMarkdown(state.currentNote.content).cover;
    if (cover?.assetPath) {
      return getStableCachedCoverEntry(cacheKey, cover);
    }
  }

  return coverSnapshotCache.get(cacheKey);
}

function coverEntryMatchesControllerCover(
  coverEntry: {
    assetPath?: string;
    positionX?: number;
    positionY?: number;
    height?: number;
    scale?: number;
  } | undefined,
  cover: NoteCoverController['cover']
) {
  return (
    (coverEntry?.assetPath ?? null) === cover.url &&
    (coverEntry?.positionX ?? 50) === cover.positionX &&
    (coverEntry?.positionY ?? 50) === cover.positionY &&
    coverEntry?.height === cover.height &&
    (coverEntry?.scale ?? 1) === cover.scale
  );
}

export function useNoteCoverController(currentNotePath?: string): NoteCoverController {
  const notesPath = useNotesStore(s => s.notesPath);
  const setNoteCover = useNotesStore(s => s.setNoteCover);
  const coverEntry = useNotesStore(
    useCallback((state) => getStableNoteCoverEntrySnapshot(currentNotePath, state), [currentNotePath])
  );
  const hasMetadataEntry = useNotesStore(
    useCallback((state) => {
      if (!currentNotePath) return false;
      const notes = state.noteMetadata?.notes;
      return Boolean(notes && Object.prototype.hasOwnProperty.call(notes, currentNotePath));
    }, [currentNotePath])
  );
  const currentNoteContent = useNotesStore(
    useCallback((state) => {
      if (hasMetadataEntry || !currentNotePath || state.currentNote?.path !== currentNotePath) {
        return null;
      }
      return state.currentNote.content;
    }, [currentNotePath, hasMetadataEntry])
  );
  const currentNoteCoverEntry = useMemo(
    () => currentNoteContent ? readNoteMetadataFromMarkdown(currentNoteContent).cover : undefined,
    [currentNoteContent]
  );
  const stableCoverEntry = coverEntry ?? (
    hasMetadataEntry ? undefined : currentNoteCoverEntry
  );

  const [pickerOpenPath, setPickerOpenPath] = useState<string | null>(null);
  const [optimisticCover, setOptimisticCover] = useState<{
    path: string;
    cover: NoteCoverController['cover'];
  } | undefined>(undefined);
  const isPickerOpen = Boolean(currentNotePath && pickerOpenPath === currentNotePath);

  useEffect(() => {
    return onNotesOverlayOpen(({ source }) => {
      if (source !== 'cover-picker') {
        setPickerOpenPath(null);
      }
    });
  }, []);

  const setExclusivePickerOpen = useCallback((open: boolean) => {
    if (!currentNotePath) {
      setPickerOpenPath(null);
      return;
    }
    if (open) {
      notifyNotesOverlayOpen('cover-picker');
    }
    setPickerOpenPath(open ? currentNotePath : null);
  }, [currentNotePath]);

  useEffect(() => {
    setPickerOpenPath(null);
    setOptimisticCover(undefined);
  }, [currentNotePath]);

  const cover = useMemo(() => {
    if (optimisticCover !== undefined && optimisticCover.path === currentNotePath) {
      return optimisticCover.cover;
    }

    return {
      url: stableCoverEntry?.assetPath ?? null,
      positionX: stableCoverEntry?.positionX ?? 50,
      positionY: stableCoverEntry?.positionY ?? 50,
      height: stableCoverEntry?.height,
      scale: stableCoverEntry?.scale ?? 1,
    };
  }, [currentNotePath, optimisticCover, stableCoverEntry]);

  useEffect(() => {
    if (optimisticCover === undefined) return;
    if (optimisticCover.path !== currentNotePath) return;
    if (!coverEntryMatchesControllerCover(stableCoverEntry, optimisticCover.cover)) return;

    setOptimisticCover(undefined);
  }, [currentNotePath, optimisticCover, stableCoverEntry]);

  const updateCover = useCallback(
    (url: string | null, positionX: number, positionY: number, height?: number, scale?: number) => {
      if (!currentNotePath) {
        return;
      }
      setOptimisticCover({
        path: currentNotePath,
        cover: url
          ? {
            url,
            positionX,
            positionY,
            height,
            scale: scale ?? 1,
          }
          : {
            url: null,
            positionX,
            positionY,
            height,
            scale: scale ?? 1,
          },
      });
      setNoteCover(
        currentNotePath,
        url
          ? {
              assetPath: url,
              positionX,
              positionY,
              height,
              scale,
            }
          : null
      );
    },
    [currentNotePath, setNoteCover]
  );

  const openCoverPicker = useCallback(() => {
    if (!currentNotePath) return;
    setExclusivePickerOpen(true);
  }, [currentNotePath, setExclusivePickerOpen]);

  return {
    cover,
    notesRootPath: resolveEffectiveNotesRootPath({ notesPath, currentNotePath }),
    currentNotePath,
    isPickerOpen,
    setPickerOpen: setExclusivePickerOpen,
    updateCover,
    openCoverPicker,
  };
}
