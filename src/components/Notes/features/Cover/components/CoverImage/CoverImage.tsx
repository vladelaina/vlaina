import { useRef, useMemo, useLayoutEffect, useEffect, useState } from 'react';
import { useCoverSource } from '../../hooks/useCoverSource';
import { useCoverState } from './hooks/useCoverState';
import { useCoverInteraction } from './hooks/useCoverInteraction';
import { useCoverResize } from './hooks/useCoverResize';
import { useCoverPickerBridge } from './hooks/useCoverPickerBridge';
import { useCoverContainerObserver } from './hooks/useCoverContainerObserver';
import { CoverImageShell } from './CoverImageShell';
import { useCoverPositionSync } from './hooks/useCoverPositionSync';
import { useCoverMediaSync } from './hooks/useCoverMediaSync';
import { coverDebug } from '../../utils/debug';

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
  useEffect(() => {
    coverDebug('boot', 'enabled');
  }, []);

  const [readySrc, setReadySrc] = useState<string | null>(null);

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
    coverDebug('CoverImage', 'preview-enter-reset-crop', {
      previewSrc: previewSrc.slice(0, 120),
    });
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

  const mediaSrc = previewSrc || resolvedSrc || prevSrcRef.current || '';
  const isSelectionCommitting = isSelectingRef.current;
  // Keep preview visual while picker is open and during selection commit transition.
  const isPreviewing = Boolean(previewSrc) && (showPicker || isSelectionCommitting);
  const hasReadyForCurrentSrc = Boolean(mediaSrc) && readySrc === mediaSrc;
  const sourceIsReady = hasReadyForCurrentSrc;
  const displayPositionX = isPreviewing ? 50 : positionX;
  const displayPositionY = isPreviewing ? 50 : positionY;
  const effectiveCrop = isPreviewing ? { x: 0, y: 0 } : crop;
  const effectiveZoom = isPreviewing ? 1 : zoom;

  useEffect(() => {
    if (!mediaSrc || readySrc !== mediaSrc || isImageReady) return;
    // Commit can keep the same src string as preview; restore ready state immediately.
    setIsImageReady(true);
    coverDebug('CoverImage', 'ready-restored-for-current-src', {
      mediaSrc: mediaSrc.slice(0, 120),
    });
  }, [mediaSrc, readySrc, isImageReady, setIsImageReady]);

  useCoverPositionSync({
    positionX,
    positionY,
    scale,
    mediaSize,
    effectiveContainerSize,
    zoom,
    isInteracting,
    isResizing,
    suspendSync: Boolean(previewSrc) || isSelectingRef.current || !sourceIsReady,
    hasPreviewSrc: Boolean(previewSrc),
    isSelectingCommit: isSelectingRef.current,
    sourceIsReady,
    ignoreCropSyncRef,
    setCrop,
  });

  useCoverContainerObserver({
    containerRef,
    isManualResizingRef,
    setContainerSize,
  });
  const placeholderSrc = sourceIsReady
    ? mediaSrc
    : (readySrc || prevSrcRef.current || mediaSrc);

  useEffect(() => {
    if (mediaSrc) return;
    setReadySrc(null);
  }, [mediaSrc]);

  const lastDisplayStateRef = useRef<string | null>(null);
  useEffect(() => {
    const stateKey = [
      url ?? '',
      showPicker ? '1' : '0',
      isSelectionCommitting ? '1' : '0',
      sourceIsReady ? '1' : '0',
      isPreviewing ? '1' : '0',
      mediaSrc || '',
      placeholderSrc || '',
      readySrc || '',
      previewSrc || '',
      resolvedSrc || '',
      isImageReady ? '1' : '0',
      isError ? '1' : '0',
      displayPositionX,
      displayPositionY,
    ].join('|');
    if (stateKey === lastDisplayStateRef.current) return;
    lastDisplayStateRef.current = stateKey;

    coverDebug('CoverImage', 'display-state', {
      url,
      showPicker,
      isSelectionCommitting,
      sourceIsReady,
      isPreviewing,
      mediaSrc: mediaSrc ? mediaSrc.slice(0, 120) : '',
      placeholderSrc: placeholderSrc ? placeholderSrc.slice(0, 120) : '',
      readySrc: readySrc ? readySrc.slice(0, 120) : null,
      previewSrc: previewSrc ? previewSrc.slice(0, 120) : null,
      resolvedSrc: resolvedSrc ? resolvedSrc.slice(0, 120) : null,
      isImageReady,
      isError,
      positionX: displayPositionX,
      positionY: displayPositionY,
      scale,
      zoom,
    });
  }, [
    url,
    showPicker,
    isSelectionCommitting,
    sourceIsReady,
    isPreviewing,
    mediaSrc,
    placeholderSrc,
    readySrc,
    previewSrc,
    resolvedSrc,
    isImageReady,
    isError,
    displayPositionX,
    displayPositionY,
    scale,
    zoom,
  ]);

  const { handleMediaLoaded } = useCoverMediaSync({
    currentSrc: mediaSrc,
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
    onSourceReady: setReadySrc,
  });

  return (
    <CoverImageShell
      url={url}
      readOnly={readOnly}
      vaultPath={vaultPath}
      showPicker={showPicker}
      previewSrc={previewSrc}
      isError={isError}
      displaySrc={mediaSrc}
      coverHeight={coverHeight}
      positionX={displayPositionX}
      positionY={displayPositionY}
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
        placeholderSrc,
        isImageReady: sourceIsReady,
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
