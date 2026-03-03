import { useRef, useMemo, useLayoutEffect } from 'react';
import { useCoverSource } from '../../hooks/useCoverSource';
import { useCoverState } from './hooks/useCoverState';
import { useCoverInteraction } from './hooks/useCoverInteraction';
import { useCoverResize } from './hooks/useCoverResize';
import { useCoverPickerBridge } from './hooks/useCoverPickerBridge';
import { useCoverContainerObserver } from './hooks/useCoverContainerObserver';
import { CoverImageShell } from './CoverImageShell';
import { useCoverPositionSync } from './hooks/useCoverPositionSync';
import { useCoverMediaSync } from './hooks/useCoverMediaSync';

interface CoverImageProps {
    url: string | null;
    positionX: number;
    positionY: number;
    height?: number;
    scale?: number;
    readOnly?: boolean;
    onUpdate: (url: string | null, positionX: number, positionY: number, height?: number, scale?: number) => void;
    vaultPath: string;
    pickerOpen?: boolean;
    onPickerOpenChange?: (open: boolean) => void;
}

export function CoverImage({
    url,
    positionX,
    positionY,
    height: initialHeight,
    scale = 1,
    readOnly = false,
    onUpdate,
    vaultPath,
    pickerOpen,
    onPickerOpenChange,
}: CoverImageProps) {
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
    resolvedSrc, previewSrc, isImageReady, setPreviewSrc, setIsImageReady,
    prevSrcRef, isError, isSelectingRef,
  } = useCoverSource({ url, vaultPath });

  const {
    handleCoverSelect,
    handlePreview,
    handlePickerClose,
  } = useCoverPickerBridge({
    url,
    coverHeight,
    vaultPath,
    onUpdate,
    setPreviewSrc,
    isSelectingRef,
    setShowPicker,
  });

  useLayoutEffect(() => {
    if (!previewSrc) return;
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setIsImageReady(false);
  }, [previewSrc, setCrop, setZoom, setIsImageReady]);

  const effectiveContainerSize = useMemo(() => {
    if (!containerSize) return null;
    return { width: containerSize.width, height: coverHeight };
  }, [containerSize, coverHeight]);

  const {
    objectFitMode, effectiveMinZoom, effectiveMaxZoom,
    handleInteractionStart, handleInteractionEnd,
    onCropperCropChange, onCropperZoomChange,
  } = useCoverInteraction({
    mediaSize, effectiveContainerSize, zoom, setZoom, crop, setCrop,
    coverHeight, url, readOnly,
    onUpdate, setIsInteracting, showPicker, setShowPicker,
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const {
    handleResizeMouseDown, frozenImageState, frozenImgRef, ignoreCropSyncRef,
  } = useCoverResize({
    mediaSize, effectiveContainerSize, zoom, crop,
    coverHeight, setCoverHeight, setCrop, setIsResizing, isManualResizingRef,
    containerRef, wrapperRef, onUpdate, url, scale,
  });

  useCoverPositionSync({
    positionX,
    positionY,
    scale,
    mediaSize,
    effectiveContainerSize,
    zoom,
    isInteracting,
    isResizing,
    ignoreCropSyncRef,
    setCrop,
  });

  useCoverContainerObserver({
    containerRef,
    isManualResizingRef,
    setContainerSize,
  });

  const displaySrc = previewSrc || resolvedSrc || prevSrcRef.current || '';
  const isPreviewing = previewSrc && !isSelectingRef.current;
  const effectiveCrop = isPreviewing ? { x: 0, y: 0 } : crop;
  const effectiveZoom = isPreviewing ? 1 : zoom;

  const { handleMediaLoaded } = useCoverMediaSync({
    effectiveContainerSize,
    isImageReady,
    previewSrc,
    positionX,
    positionY,
    zoom,
    setMediaSize,
    setCrop,
    setZoom,
    setIsImageReady,
  });

  return (
    <CoverImageShell
      url={url}
      readOnly={readOnly}
      vaultPath={vaultPath}
      showPicker={showPicker}
      previewSrc={previewSrc}
      isError={isError}
      displaySrc={displaySrc}
      coverHeight={coverHeight}
      positionX={positionX}
      positionY={positionY}
      containerRef={containerRef}
      onOpenPicker={() => setShowPicker(true)}
      onClosePicker={handlePickerClose}
      onSelectCover={handleCoverSelect}
      onPreview={handlePreview}
      onRemoveCover={() => onUpdate(null, 50, 50)}
      onResizeMouseDown={handleResizeMouseDown}
      onResetHeight={() => {
        const goldenHeight = Math.round(window.innerHeight * 0.236);
        setCoverHeight(goldenHeight);
        onUpdate(url, positionX, positionY, goldenHeight, scale);
      }}
      rendererProps={{
        isImageReady,
        isResizing,
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
        onInteractionStart: handleInteractionStart,
        onInteractionEnd: handleInteractionEnd,
        onMediaLoaded: handleMediaLoaded,
      }}
    />
  );
}
