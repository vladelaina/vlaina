import { useCallback, useMemo, useRef } from 'react';
import { DEFAULT_POSITION_PERCENT, DEFAULT_SCALE, loadImageWithDimensions } from '../../../utils/coverUtils';
import { useCoverSource } from '../../../hooks/useCoverSource';
import { resolveCoverAssetUrl } from '../../../utils/resolveCoverAssetUrl';

interface UseCoverSelectionFlowOptions {
  url: string | null;
  coverHeight: number;
  vaultPath: string;
  onUpdate: (url: string | null, positionX: number, positionY: number, height?: number, scale?: number) => void;
  setShowPicker: (open: boolean) => void;
}

export type CoverFlowPhase = 'idle' | 'previewing' | 'committing' | 'ready' | 'error';

export function useCoverSelectionFlow({
  url,
  coverHeight,
  vaultPath,
  onUpdate,
  setShowPicker,
}: UseCoverSelectionFlowOptions) {
  const {
    resolvedSrc,
    previewSrc,
    setPreviewSrc,
    isImageReady,
    setIsImageReady,
    isError,
    isSelectionCommitting,
    beginSelectionCommit,
    endSelectionCommit,
    prevSrcRef,
  } = useCoverSource({ url, vaultPath });

  const phase: CoverFlowPhase = useMemo(() => {
    if (isError) return 'error';
    if (!url && !previewSrc) return 'idle';
    if (isSelectionCommitting) return 'committing';
    if (previewSrc) return 'previewing';
    return 'ready';
  }, [isError, isSelectionCommitting, previewSrc, url]);

  const lastPreviewPathRef = useRef<string | null>(null);

  const handleCoverSelect = useCallback((assetPath: string) => {
    if (assetPath === url) {
      setPreviewSrc(null);
      endSelectionCommit();
      onUpdate(assetPath, DEFAULT_POSITION_PERCENT, DEFAULT_POSITION_PERCENT, coverHeight, DEFAULT_SCALE);
      setShowPicker(false);
      return;
    }

    beginSelectionCommit();
    onUpdate(assetPath, DEFAULT_POSITION_PERCENT, DEFAULT_POSITION_PERCENT, coverHeight, DEFAULT_SCALE);
    setShowPicker(false);
  }, [
    beginSelectionCommit,
    coverHeight,
    endSelectionCommit,
    onUpdate,
    setPreviewSrc,
    setShowPicker,
    url,
  ]);

  const handlePreview = useCallback(async (assetPath: string | null) => {
    lastPreviewPathRef.current = assetPath;
    if (assetPath) endSelectionCommit();

    if (!assetPath) {
      if (!isSelectionCommitting) setPreviewSrc(null);
      return;
    }

    try {
      const imageUrl = await resolveCoverAssetUrl({
        assetPath,
        vaultPath,
        localCategory: 'auto',
      });
      const dimensions = await loadImageWithDimensions(imageUrl);
      if (!dimensions) {
        if (assetPath === lastPreviewPathRef.current) setPreviewSrc(null);
        return;
      }
      if (assetPath === lastPreviewPathRef.current) setPreviewSrc(imageUrl);
    } catch {
      if (assetPath === lastPreviewPathRef.current) setPreviewSrc(null);
    }
  }, [endSelectionCommit, isSelectionCommitting, setPreviewSrc, vaultPath]);

  const handlePickerClose = useCallback(() => {
    if (!isSelectionCommitting) {
      setPreviewSrc(null);
    }
    setShowPicker(false);
  }, [isSelectionCommitting, setPreviewSrc, setShowPicker]);

  return {
    resolvedSrc,
    previewSrc,
    isImageReady,
    setIsImageReady,
    isError,
    isSelectionCommitting,
    phase,
    prevSrcRef,
    handleCoverSelect,
    handlePreview,
    handlePickerClose,
  };
}
