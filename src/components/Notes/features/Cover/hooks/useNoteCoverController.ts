import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNotesStore } from '@/stores/useNotesStore';
import { getRandomBuiltinCover } from '@/lib/assets/builtinCovers';
import { resolveEffectiveVaultPath } from '@/stores/notes/effectiveVaultPath';
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
      if (!currentNotePath) return;
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
    setPickerOpen(true);
  }, [currentNotePath, setNoteCover]);

  return {
    cover,
    vaultPath: resolveEffectiveVaultPath({ notesPath, currentNotePath }),
    currentNotePath,
    isPickerOpen,
    setPickerOpen,
    updateCover,
    addRandomCoverAndOpenPicker,
  };
}
