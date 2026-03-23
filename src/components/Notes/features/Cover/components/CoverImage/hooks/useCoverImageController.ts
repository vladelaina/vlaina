import { useEffect, useMemo } from 'react';
import { useUIStore } from '@/stores/uiSlice';
import { useCoverState } from './state/useCoverState';
import { useCoverDisplayModel } from './display/useCoverDisplayModel';
import { useCoverPreviewReset } from './display/useCoverPreviewReset';
import { useCoverSelectionFlow } from './source/useCoverSelectionFlow';
import { useCoverInteractionController } from './useCoverInteractionController';
import { useCoverMediaController } from './display/useCoverMediaController';
import { useStableCoverContainerSize } from './display/useStableCoverContainerSize';
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
  pickerOpen,
  onPickerOpenChange,
}: UseCoverImageControllerProps): CoverImageControllerModel {
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

  const interactionContainerSize = useStableCoverContainerSize({
    effectiveContainerSize,
    freeze: windowResizeActive,
  });

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
    suspendPositionSync,
    handleSourceReady,
  } = useCoverDisplayModel({
    phase,
    previewSrc,
    resolvedSrc,
    prevSrcRef,
    crop,
    zoom,
    positionX,
    positionY,
    isImageReady,
    setIsImageReady,
  });

  useEffect(() => {
    if (!mediaSrc) {
      setMediaSize(null);
      return;
    }

    const cached = getCachedDimensions(mediaSrc);
    if (!cached) return;

    setMediaSize((prev) => {
      if (prev?.width === cached.width && prev?.height === cached.height) {
        return prev;
      }
      return { width: cached.width, height: cached.height };
    });
  }, [mediaSrc, setMediaSize]);

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
    mediaSize,
    effectiveContainerSize: interactionContainerSize,
    windowResizeActive,
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
    effectiveContainerSize: interactionContainerSize,
    isImageReady,
    syncPositionX,
    syncPositionY,
    syncZoom,
    setMediaSize,
    setCrop,
    setZoom,
    setIsImageReady,
    onSourceReady: handleSourceReady,
  });

  return {
    url,
    readOnly,
    vaultPath,
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
    onRemoveCover: () => onUpdate(null, DEFAULT_POSITION_PERCENT, DEFAULT_POSITION_PERCENT),
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
      isImageReady: sourceIsReady,
      isResizing,
      isResizeSettling,
      mediaSize,
      wrapperRef,
      frozenImgRef,
      frozenImageState,
      crop: effectiveCrop,
      zoom: effectiveZoom,
      effectiveContainerSize: interactionContainerSize,
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
