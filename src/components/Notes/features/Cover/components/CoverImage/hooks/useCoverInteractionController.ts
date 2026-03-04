import { useRef } from 'react';
import { useCoverInteraction } from './useCoverInteraction';
import { useCoverResize } from './useCoverResize';
import { useCoverPositionSync } from './useCoverPositionSync';
import { useCoverContainerObserver } from './useCoverContainerObserver';

interface UseCoverInteractionControllerProps {
  mediaSize: { width: number; height: number } | null;
  effectiveContainerSize: { width: number; height: number } | null;
  zoom: number;
  setZoom: (zoom: number) => void;
  crop: { x: number; y: number };
  setCrop: (crop: { x: number; y: number }) => void;
  coverHeight: number;
  setCoverHeight: (height: number) => void;
  url: string | null;
  scale: number;
  readOnly: boolean;
  onUpdate: (url: string | null, positionX: number, positionY: number, height?: number, scale?: number) => void;
  setIsInteracting: (interacting: boolean) => void;
  showPicker: boolean;
  setShowPicker: (show: boolean) => void;
  positionX: number;
  positionY: number;
  isInteracting: boolean;
  isResizing: boolean;
  setIsResizing: (resizing: boolean) => void;
  isManualResizingRef: React.MutableRefObject<boolean>;
  setContainerSize: React.Dispatch<React.SetStateAction<{ width: number; height: number } | null>>;
  suspendPositionSync: boolean;
}

export function useCoverInteractionController({
  mediaSize,
  effectiveContainerSize,
  zoom,
  setZoom,
  crop,
  setCrop,
  coverHeight,
  setCoverHeight,
  url,
  scale,
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
}: UseCoverInteractionControllerProps) {
  const {
    objectFitMode, effectiveMinZoom, effectiveMaxZoom,
    handleInteractionStart, handleInteractionEnd,
    onCropperCropChange, onCropperZoomChange,
    markPointerIntent, markNonPointerIntent,
  } = useCoverInteraction({
    mediaSize,
    effectiveContainerSize,
    zoom,
    setZoom,
    crop,
    setCrop,
    coverHeight,
    url,
    readOnly,
    onUpdate,
    setIsInteracting,
    showPicker,
    setShowPicker,
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const {
    handleResizeMouseDown, frozenImageState, frozenImgRef, ignoreCropSyncRef,
  } = useCoverResize({
    mediaSize,
    effectiveContainerSize,
    zoom,
    crop,
    coverHeight,
    setCoverHeight,
    setCrop,
    setIsResizing,
    isManualResizingRef,
    containerRef,
    wrapperRef,
    onUpdate,
    url,
    scale,
  });

  useCoverPositionSync({
    positionX,
    positionY,
    mediaSize,
    effectiveContainerSize,
    zoom,
    isInteracting,
    isResizing,
    suspendSync: suspendPositionSync,
    ignoreCropSyncRef,
    setCrop,
  });

  useCoverContainerObserver({
    containerRef,
    isManualResizingRef,
    setContainerSize,
  });

  return {
    objectFitMode,
    effectiveMinZoom,
    effectiveMaxZoom,
    handleInteractionStart,
    handleInteractionEnd,
    onCropperCropChange,
    onCropperZoomChange,
    markPointerIntent,
    markNonPointerIntent,
    containerRef,
    wrapperRef,
    handleResizeMouseDown,
    frozenImageState,
    frozenImgRef,
  };
}
