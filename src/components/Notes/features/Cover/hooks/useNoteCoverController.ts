import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNotesStore } from '@/stores/useNotesStore';
import { resolveEffectiveVaultPath } from '@/stores/notes/effectiveVaultPath';
import { notifyNotesOverlayOpen, onNotesOverlayOpen } from '@/components/Notes/features/overlays/notesOverlayEvents';
import type { NoteCoverController } from '../types';

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
    useCallback((state) => {
      if (!currentNotePath) return undefined;
      return state.noteMetadata?.notes[currentNotePath]?.cover;
    }, [currentNotePath])
  );

  const [isPickerOpen, setPickerOpen] = useState(false);
  const [optimisticCover, setOptimisticCover] = useState<NoteCoverController['cover'] | undefined>(undefined);

  useEffect(() => {
    return onNotesOverlayOpen(({ source }) => {
      if (source !== 'cover-picker') {
        setPickerOpen(false);
      }
    });
  }, []);

  const setExclusivePickerOpen = useCallback((open: boolean) => {
    if (open) {
      notifyNotesOverlayOpen('cover-picker');
    }
    setPickerOpen(open);
  }, []);

  useEffect(() => {
    setPickerOpen(false);
    setOptimisticCover(undefined);
  }, [currentNotePath]);

  const cover = useMemo(() => {
    if (optimisticCover !== undefined) {
      return optimisticCover;
    }

    return {
      url: coverEntry?.assetPath ?? null,
      positionX: coverEntry?.positionX ?? 50,
      positionY: coverEntry?.positionY ?? 50,
      height: coverEntry?.height,
      scale: coverEntry?.scale ?? 1,
    };
  }, [coverEntry, optimisticCover]);

  useEffect(() => {
    if (optimisticCover === undefined) return;
    if (!coverEntryMatchesControllerCover(coverEntry, optimisticCover)) return;

    setOptimisticCover(undefined);
  }, [coverEntry, optimisticCover]);

  const updateCover = useCallback(
    (url: string | null, positionX: number, positionY: number, height?: number, scale?: number) => {
      if (!currentNotePath) {
        return;
      }
      setOptimisticCover(
        url
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
            }
      );
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
    vaultPath: resolveEffectiveVaultPath({ notesPath, currentNotePath }),
    currentNotePath,
    isPickerOpen,
    setPickerOpen: setExclusivePickerOpen,
    updateCover,
    openCoverPicker,
  };
}
