import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNotesStore } from '@/stores/useNotesStore';
import { getRandomBuiltinCover } from '@/lib/assets/builtinCovers';
import { getNoteMetadataEntry } from '@/stores/notes/noteMetadataState';
import type { NoteCoverController } from '../types';

export function useNoteCoverController(currentNotePath?: string): NoteCoverController {
  const notesPath = useNotesStore(s => s.notesPath);
  const setNoteCover = useNotesStore(s => s.setNoteCover);
  const coverEntry = useNotesStore(
    useCallback((state) => {
      return getNoteMetadataEntry(state.noteMetadata, currentNotePath);
    }, [currentNotePath])
  );

  const [isPickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    setPickerOpen(false);
  }, [currentNotePath]);

  const cover = useMemo(() => {
    return {
      url: coverEntry?.cover ?? null,
      positionX: coverEntry?.coverX ?? 50,
      positionY: coverEntry?.coverY ?? 50,
      height: coverEntry?.coverH,
      scale: coverEntry?.coverScale ?? 1,
    };
  }, [coverEntry]);

  const updateCover = useCallback(
    (url: string | null, positionX: number, positionY: number, height?: number, scale?: number) => {
      if (!currentNotePath) return;
      setNoteCover(currentNotePath, url, positionX, positionY, height, scale);
    },
    [currentNotePath, setNoteCover]
  );

  const addRandomCoverAndOpenPicker = useCallback(() => {
    if (!currentNotePath) return;

    const allCovers = useNotesStore.getState().getAssetList('covers');
    const nextCover = allCovers.length > 0
      ? allCovers[Math.floor(Math.random() * allCovers.length)].filename
      : getRandomBuiltinCover();

    setNoteCover(currentNotePath, nextCover, 50, 50, 200, 1);
    setPickerOpen(true);
  }, [currentNotePath, setNoteCover]);

  return {
    cover,
    vaultPath: notesPath || '',
    isPickerOpen,
    setPickerOpen,
    updateCover,
    addRandomCoverAndOpenPicker,
  };
}
