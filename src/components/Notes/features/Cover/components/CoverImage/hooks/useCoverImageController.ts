import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useUIStore } from '@/stores/uiSlice';
import { useCoverState } from './state/useCoverState';
import { useCoverDisplayModel } from './display/useCoverDisplayModel';
import { useCoverPreviewReset } from './display/useCoverPreviewReset';
import { useCoverSelectionFlow } from './source/useCoverSelectionFlow';
import { useCoverInteractionController } from './useCoverInteractionController';
import { useCoverMediaController } from './display/useCoverMediaController';
import type { CoverImageControllerModel, CoverImageProps } from '../coverImage.types';
import { DEFAULT_POSITION_PERCENT } from '../../../utils/coverConstants';
import { getCachedDimensions } from '../../../utils/coverDimensionCache';

interface UseCoverImageControllerProps extends Omit<CoverImageProps, 'height' | 'scale' | 'readOnly'> {
  initialHeight?: number;
  scale: number;
  readOnly: boolean;
}

export function useCoverImageController({
  url,
  positionX,
  positionY,
  initialHeight,
  scale,
  readOnly,
  onUpdate,
  vaultPath,
  currentNotePath,
  pickerOpen,
  onPickerOpenChange,
}: UseCoverImageControllerProps): CoverImageControllerModel {
  const stableMediaStateRef = useRef<{
    src: string;
    size: { width: number; height: number };
  } | null>(null);
  const [mediaSizeSrc, setMediaSizeSrc] = useState<string | null>(null);
  const layoutPanelDragging = useUIStore((state) => state.layoutPanelDragging);
  const windowResizeActive = useUIStore((state) => state.windowResizeActive);
  const {
    coverHeight, setCoverHeight,
    containerSize, setContainerSize,
    mediaSize, setMediaSize,
    crop, setCrop,
    zoom, setZoom,
    isInteracting, setIsInteracting,
    isResizing, setIsResizing,
    isManualResizingRef,
    showPicker, setShowPicker,
  } = useCoverState({ initialHeight, scale, pickerOpen, onPickerOpenChange });

  const {
    resolvedSrc,
    previewSrc,
    phase,
    isResolvedSourceStale,
    isImageReady,
    setIsImageReady,
    prevSrcRef,
    isError,
    handleCoverSelect,
    handlePreview,
    handlePickerClose,
  } = useCoverSelectionFlow({
    url,
    coverHeight,
    vaultPath,
    currentNotePath,
    onUpdate,
    setShowPicker,
  });

  useCoverPreviewReset({
    previewSrc,
    setCrop,
    setZoom,
    setIsImageReady,
  });

  const effectiveContainerSize = useMemo(() => {
    if (!containerSize) return null;
    if (containerSize.width <= 0 || coverHeight <= 0) return null;
    return { width: containerSize.width, height: coverHeight };
  }, [containerSize, coverHeight]);

  const {
    mediaSrc,
    sourceIsReady,
    displayPositionX,
    displayPositionY,
    effectiveCrop,
    effectiveZoom,
    syncPositionX,
    syncPositionY,
    syncZoom,
    placeholderSrc,
    isHoldingPreviousFrame,
    suspendPositionSync,
    handleSourceReady,
  } = useCoverDisplayModel({
    phase,
    previewSrc,
    resolvedSrc,
    isSourceStale: isResolvedSourceStale,
    prevSrcRef,
    crop,
    zoom,
    positionX,
    positionY,
    isImageReady,
    setIsImageReady,
  });

  const cachedMediaSize = useMemo(() => {
    if (!mediaSrc) {
      return null;
    }

    return getCachedDimensions(mediaSrc) ?? null;
  }, [mediaSrc]);

  const effectiveMediaSize = useMemo(() => {
    if (mediaSize && mediaSizeSrc === mediaSrc) {
      return mediaSize;
    }

    return cachedMediaSize;
  }, [cachedMediaSize, mediaSize, mediaSizeSrc, mediaSrc]);

  useEffect(() => {
    if (!sourceIsReady || !mediaSrc || !effectiveMediaSize) {
      return;
    }

    stableMediaStateRef.current = {
      src: mediaSrc,
      size: effectiveMediaSize,
    };
  }, [effectiveMediaSize, mediaSrc, sourceIsReady]);

  const placeholderMediaSize = useMemo(() => {
    if (
      isHoldingPreviousFrame &&
      placeholderSrc &&
      stableMediaStateRef.current?.src === placeholderSrc
    ) {
      return stableMediaStateRef.current.size;
    }

    return effectiveMediaSize;
  }, [effectiveMediaSize, isHoldingPreviousFrame, placeholderSrc]);

  const handleResolvedMediaSize = useCallback((src: string, size: { width: number; height: number }) => {
    setMediaSizeSrc((prevSrc) => (prevSrc === src ? prevSrc : src));
    setMediaSize((prev) => {
      if (prev?.width === size.width && prev?.height === size.height) {
        return prev;
      }
      return size;
    });
  }, [setMediaSize]);

  useEffect(() => {
    if (!mediaSrc) {
      setMediaSizeSrc(null);
      setMediaSize(null);
      return;
    }

    if (!cachedMediaSize) {
      if (mediaSizeSrc !== mediaSrc) {
        setMediaSizeSrc(null);
        setMediaSize(null);
      }
      return;
    }

    setMediaSizeSrc(mediaSrc);
    setMediaSize((prev) => {
      if (prev?.width === cachedMediaSize.width && prev?.height === cachedMediaSize.height) {
        return prev;
      }
      return { width: cachedMediaSize.width, height: cachedMediaSize.height };
    });
  }, [cachedMediaSize, mediaSizeSrc, mediaSrc, setMediaSize]);

  const {
    objectFitMode,
    effectiveMinZoom,
    effectiveMaxZoom,
    handleInteractionStart,
    handleInteractionEnd,
    onCropperCropChange,
    onCropperZoomChange,
    markPointerIntent,
    markPointerMoveIntent,
    markNonPointerIntent,
    containerRef,
    wrapperRef,
    handleResizeMouseDown,
    isResizeSettling,
    isContainerResizing,
    frozenImageState,
    frozenImgRef,
  } = useCoverInteractionController({
    mediaSize: effectiveMediaSize,
    effectiveContainerSize,
    zoom,
    setZoom,
    crop,
    setCrop,
    coverHeight,
    setCoverHeight,
    url,
    readOnly,
    onUpdate,
    setIsInteracting,
    showPicker,
    setShowPicker,
    positionX,
    positionY,
    isInteracting,
    isResizing,
    setIsResizing,
    isManualResizingRef,
    setContainerSize,
    suspendPositionSync,
  });

  const { handleMediaLoaded } = useCoverMediaController({
    mediaSrc,
    effectiveContainerSize,
    isImageReady,
    syncPositionX,
    syncPositionY,
    syncZoom,
    setMediaSize: handleResolvedMediaSize,
    setCrop,
    setZoom,
    setIsImageReady,
    onSourceReady: handleSourceReady,
  });

  return {
    url,
    readOnly,
    vaultPath,
    currentNotePath,
    phase,
    showPicker,
    previewSrc,
    isError,
    displaySrc: mediaSrc,
    coverHeight,
    positionX: displayPositionX,
    positionY: displayPositionY,
    containerRef,
    onOpenPicker: () => setShowPicker(true),
    onClosePicker: handlePickerClose,
    onSelectCover: handleCoverSelect,
    onPreview: handlePreview,
    onRemoveCover: () => {
      void handlePreview(null);
      setIsImageReady(false);
      onUpdate(null, DEFAULT_POSITION_PERCENT, DEFAULT_POSITION_PERCENT);
    },
    onResizeMouseDown: handleResizeMouseDown,
    onResetHeight: () => {
      const goldenHeight = Math.round(window.innerHeight * 0.236);
      setCoverHeight(goldenHeight);
      onUpdate(url, positionX, positionY, goldenHeight, scale);
    },
    rendererProps: {
      layoutPanelDragging,
      isWindowResizing: windowResizeActive,
      isContainerResizing,
      placeholderSrc,
      placeholderMediaSize,
      isImageReady: sourceIsReady,
      isResizing,
      isResizeSettling,
      mediaSize: effectiveMediaSize,
      wrapperRef,
      frozenImgRef,
      frozenImageState,
      crop: effectiveCrop,
      zoom: effectiveZoom,
      effectiveContainerSize,
      effectiveMinZoom,
      effectiveMaxZoom,
      objectFitMode,
      onCropperCropChange,
      onCropperZoomChange,
      onPointerIntent: markPointerIntent,
      onPointerMoveIntent: markPointerMoveIntent,
      onNonPointerIntent: markNonPointerIntent,
      onInteractionStart: handleInteractionStart,
      onInteractionEnd: handleInteractionEnd,
      onMediaLoaded: handleMediaLoaded,
    },
  };
}
