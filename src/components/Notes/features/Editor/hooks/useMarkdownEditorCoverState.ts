import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNoteCoverController } from '../../Cover';
import { resolveDefaultCoverHeight } from '../../Cover/utils/coverConstants';
import {
  canKeepCoverDuringEditorReload,
  getStableCoverSignature,
  type RenderedCoverSnapshot,
} from '../utils/coverRenderStability';

export function useMarkdownEditorCoverState({
  currentNotePath,
  hasActiveNote,
  isEditorViewReady,
}: {
  currentNotePath: string | undefined;
  hasActiveNote: boolean;
  isEditorViewReady: boolean;
}) {
  const lastRenderedCoverRef = useRef<RenderedCoverSnapshot | null>(null);
  const coverController = useNoteCoverController(currentNotePath);
  const [previewLayoutPath, setPreviewLayoutPath] = useState<string | null>(null);
  const coverUrl = coverController.cover.url;
  const handlePreviewLayoutActiveChange = useCallback((active: boolean) => {
    setPreviewLayoutPath((current) => {
      if (active) return currentNotePath ?? null;
      return current === currentNotePath ? null : current;
    });
  }, [currentNotePath]);
  const coverSignature = useMemo(
    () => getStableCoverSignature(coverController.cover),
    [coverController.cover]
  );
  const shouldRenderCover = hasActiveNote && (
    isEditorViewReady ||
    canKeepCoverDuringEditorReload({
      hasActiveNote,
      isEditorViewReady,
      coverUrl,
      currentNotePath,
      coverSignature,
      lastRenderedCover: lastRenderedCoverRef.current,
    })
  );
  const canRenderPendingCover = hasActiveNote && Boolean(coverUrl);
  const transitionCoverSnapshot =
    hasActiveNote &&
    !coverUrl &&
    !shouldRenderCover &&
    !isEditorViewReady &&
    lastRenderedCoverRef.current?.notePath === currentNotePath
      ? lastRenderedCoverRef.current
      : null;
  const transitionCoverController = useMemo(() => {
    if (!transitionCoverSnapshot?.cover.url) {
      return null;
    }

    return {
      cover: transitionCoverSnapshot.cover,
      notesRootPath: transitionCoverSnapshot.notesRootPath,
      currentNotePath: transitionCoverSnapshot.notePath,
      isPickerOpen: false,
      setPickerOpen: () => undefined,
      updateCover: () => undefined,
      openCoverPicker: () => undefined,
    };
  }, [transitionCoverSnapshot]);
  const renderedCoverController = (shouldRenderCover || canRenderPendingCover)
    ? coverController
    : transitionCoverController;

  useEffect(() => {
    if (shouldRenderCover && coverSignature) {
      lastRenderedCoverRef.current = {
        notePath: currentNotePath,
        coverSignature,
        cover: { ...coverController.cover },
        notesRootPath: coverController.notesRootPath,
      };
      return;
    }

    if (!hasActiveNote || !coverSignature) {
      lastRenderedCoverRef.current = null;
    }
  }, [coverController.cover, coverController.notesRootPath, coverSignature, currentNotePath, hasActiveNote, shouldRenderCover]);

  return {
    coverController,
    coverLayoutActive:
      Boolean(coverUrl) ||
      Boolean(renderedCoverController?.cover.url) ||
      Boolean(currentNotePath && previewLayoutPath === currentNotePath),
    coverUrl,
    handlePreviewLayoutActiveChange,
    renderedCoverController,
    reservedCoverHeight: coverController.cover.height ?? resolveDefaultCoverHeight(),
    shouldRenderCover,
    shouldReserveCoverSpace: hasActiveNote && Boolean(coverUrl) && !renderedCoverController,
  };
}
