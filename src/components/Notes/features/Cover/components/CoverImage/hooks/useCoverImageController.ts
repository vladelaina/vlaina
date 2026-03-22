import { useEffect, useMemo } from 'react';
import { useCoverState } from './useCoverState';
import { useCoverDisplayModel } from './useCoverDisplayModel';
import { useCoverPreviewReset } from './useCoverPreviewReset';
import { useCoverSelectionFlow } from './useCoverSelectionFlow';
import { useCoverInteractionController } from './useCoverInteractionController';
import { useCoverMediaController } from './useCoverMediaController';
import type { CoverImageControllerModel, CoverImageProps } from '../coverImage.types';
import { DEFAULT_POSITION_PERCENT, getCachedDimensions } from '../../../utils/coverUtils';

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

  // Prime media size from cached dimensions as soon as source switches.
  // This avoids first-frame wrong objectFit axis before cropper onMediaLoaded fires.
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
    frozenImageState,
    frozenImgRef,
  } = useCoverInteractionController({
    mediaSize,
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
