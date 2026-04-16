import { useCallback, useMemo, useRef } from 'react';
import { DEFAULT_POSITION_PERCENT, DEFAULT_SCALE } from '../../../../utils/coverConstants';
import { loadImageWithDimensions } from '../../../../utils/coverDimensionCache';
import { useCoverSource } from '../../../../hooks/useCoverSource';
import { resolveCoverAssetUrl } from '../../../../utils/resolveCoverAssetUrl';
import { resolveCoverFlowPhase } from './coverSelectionPhase';

interface UseCoverSelectionFlowOptions {
  url: string | null;
  coverHeight: number;
  vaultPath: string;
  currentNotePath?: string;
  onUpdate: (url: string | null, positionX: number, positionY: number, height?: number, scale?: number) => void;
  setShowPicker: (open: boolean) => void;
}

export function useCoverSelectionFlow({
  url,
  coverHeight,
  vaultPath,
  currentNotePath,
  onUpdate,
  setShowPicker,
}: UseCoverSelectionFlowOptions) {
  const {
    resolvedSrc,
    previewSrc,
    isResolvedSourceStale,
    setPreviewSrc,
    isImageReady,
    setIsImageReady,
    isError,
    isSelectionCommitting,
    beginSelectionCommit,
    endSelectionCommit,
    prevSrcRef,
  } = useCoverSource({ url, vaultPath, currentNotePath });

  const phase = useMemo(() => resolveCoverFlowPhase({
    url,
    previewSrc,
    isError,
    isSelectionCommitting,
  }), [isError, isSelectionCommitting, previewSrc, url]);

  const lastPreviewPathRef = useRef<string | null>(null);
  const previewRequestRef = useRef(new Map<string, Promise<string | null>>());

  const handleCoverSelect = useCallback((assetPath: string) => {
    const previewedAssetPath = lastPreviewPathRef.current;
    lastPreviewPathRef.current = null;

    if (assetPath === url) {
      setPreviewSrc(null);
      endSelectionCommit();
      onUpdate(assetPath, DEFAULT_POSITION_PERCENT, DEFAULT_POSITION_PERCENT, coverHeight, DEFAULT_SCALE);
      setShowPicker(false);
      return;
    }

    const shouldKeepPreview =
      Boolean(previewSrc) &&
      assetPath === previewedAssetPath;

    if (!shouldKeepPreview) {
      setPreviewSrc(null);
    }
    beginSelectionCommit();
    onUpdate(assetPath, DEFAULT_POSITION_PERCENT, DEFAULT_POSITION_PERCENT, coverHeight, DEFAULT_SCALE);
    setShowPicker(false);
  }, [
    beginSelectionCommit,
    coverHeight,
    endSelectionCommit,
    onUpdate,
    previewSrc,
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
      const requestKey = `${vaultPath}::${assetPath}`;
      let request = previewRequestRef.current.get(requestKey);
      if (!request) {
        request = (async () => {
          try {
            const imageUrl = await resolveCoverAssetUrl({
              assetPath,
              vaultPath,
              currentNotePath,
            });
            const dimensions = await loadImageWithDimensions(imageUrl);
            return dimensions ? imageUrl : null;
          } finally {
            previewRequestRef.current.delete(requestKey);
          }
        })();
        previewRequestRef.current.set(requestKey, request);
      }

      const imageUrl = await request;
      if (!imageUrl) {
        if (assetPath === lastPreviewPathRef.current) setPreviewSrc(null);
        return;
      }
      if (assetPath === lastPreviewPathRef.current) {
        if (assetPath === url || imageUrl === resolvedSrc) {
          setPreviewSrc(null);
          return;
        }
        setPreviewSrc(imageUrl);
      }
    } catch {
      if (assetPath === lastPreviewPathRef.current) setPreviewSrc(null);
    }
  }, [currentNotePath, endSelectionCommit, isSelectionCommitting, resolvedSrc, setPreviewSrc, url, vaultPath]);

  const handlePickerClose = useCallback(() => {
    lastPreviewPathRef.current = null;
    if (!isSelectionCommitting) {
      setPreviewSrc(null);
    }
    setShowPicker(false);
  }, [isSelectionCommitting, setPreviewSrc, setShowPicker, url]);

  return {
    resolvedSrc,
    previewSrc,
    isResolvedSourceStale,
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
