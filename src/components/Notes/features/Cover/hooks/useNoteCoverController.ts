import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNotesStore } from '@/stores/useNotesStore';
import { getRandomBuiltinCover } from '@/lib/assets/builtinCovers';
import { resolveEffectiveVaultPath } from '@/stores/notes/effectiveVaultPath';
import { logNotesDebugAlways } from '@/stores/notes/lineBreakDebugLog';
import { notifyNotesOverlayOpen, onNotesOverlayOpen } from '@/components/Notes/features/overlays/notesOverlayEvents';
import type { NoteCoverController } from '../types';

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
  }, [currentNotePath]);

  const cover = useMemo(() => {
    return {
      url: coverEntry?.assetPath ?? null,
      positionX: coverEntry?.positionX ?? 50,
      positionY: coverEntry?.positionY ?? 50,
      height: coverEntry?.height,
      scale: coverEntry?.scale ?? 1,
    };
  }, [coverEntry]);

  const updateCover = useCallback(
    (url: string | null, positionX: number, positionY: number, height?: number, scale?: number) => {
      logNotesDebugAlways('NotesCoverController', 'update-cover:start', {
        currentNotePath,
        url,
        positionX,
        positionY,
        height,
        scale,
      });
      if (!currentNotePath) {
        logNotesDebugAlways('NotesCoverController', 'update-cover:missing-note', { url });
        return;
      }
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
      logNotesDebugAlways('NotesCoverController', 'update-cover:dispatched', {
        currentNotePath,
        url,
      });
    },
    [currentNotePath, setNoteCover]
  );

  const addRandomCoverAndOpenPicker = useCallback(() => {
    if (!currentNotePath) return;

    const allCovers = useNotesStore.getState().getAssetList('builtinCovers');
    const nextCover = allCovers.length > 0
      ? allCovers[Math.floor(Math.random() * allCovers.length)].filename
      : getRandomBuiltinCover();

    setNoteCover(currentNotePath, {
      assetPath: nextCover,
      positionX: 50,
      positionY: 50,
      height: 200,
      scale: 1,
    });
    setExclusivePickerOpen(true);
  }, [currentNotePath, setExclusivePickerOpen, setNoteCover]);

  return {
    cover,
    vaultPath: resolveEffectiveVaultPath({ notesPath, currentNotePath }),
    currentNotePath,
    isPickerOpen,
    setPickerOpen: setExclusivePickerOpen,
    updateCover,
    addRandomCoverAndOpenPicker,
  };
}
