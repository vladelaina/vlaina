import { useCallback, useRef } from 'react';
import { clampCropToBounds, type TranslateBounds } from './coverInteractionMath';
import { coverDebug } from '../../../utils/debug';
import { DRAG_THRESHOLD } from '../../../utils/coverUtils';

interface UseCoverInteractionHandlersProps {
  readOnly: boolean;
  cachedBounds: TranslateBounds;
  effectiveMinZoom: number;
  setCrop: (crop: { x: number; y: number }) => void;
  setZoom: (zoom: number) => void;
  setIsInteracting: (interacting: boolean) => void;
  showPicker: boolean;
  setShowPicker: (show: boolean) => void;
  crop: { x: number; y: number };
  zoom: number;
  saveToDb: (crop: { x: number; y: number }, zoom: number) => void;
}

export function useCoverInteractionHandlers({
  readOnly,
  cachedBounds,
  effectiveMinZoom,
  setCrop,
  setZoom,
  setIsInteracting,
  showPicker,
  setShowPicker,
  crop,
  zoom,
  saveToDb,
}: UseCoverInteractionHandlersProps) {
  const dragOccurredRef = useRef(false);
  const wasPickerOpenRef = useRef(false);
  const interactionStartCropRef = useRef(crop);
  const interactionStartZoomRef = useRef(zoom);
  const maxCropDeltaRef = useRef({ x: 0, y: 0 });
  const maxZoomDeltaRef = useRef(0);
  const dragDetectedLoggedRef = useRef(false);

  const handleInteractionStart = useCallback(() => {
    setIsInteracting(true);
    dragOccurredRef.current = false;
    wasPickerOpenRef.current = showPicker;
    interactionStartCropRef.current = crop;
    interactionStartZoomRef.current = zoom;
    maxCropDeltaRef.current = { x: 0, y: 0 };
    maxZoomDeltaRef.current = 0;
    dragDetectedLoggedRef.current = false;
    coverDebug('useCoverInteractionHandlers', 'interaction-start', {
      pickerWasOpen: showPicker,
      cropX: crop.x,
      cropY: crop.y,
      zoom,
    });
  }, [showPicker, crop, zoom, setIsInteracting]);

  const handleInteractionEnd = useCallback(() => {
    setIsInteracting(false);

    if (dragOccurredRef.current) {
      saveToDb(crop, zoom);
      coverDebug('useCoverInteractionHandlers', 'interaction-end-drag-commit', {
        cropX: crop.x,
        cropY: crop.y,
        zoom,
        maxCropDeltaX: maxCropDeltaRef.current.x,
        maxCropDeltaY: maxCropDeltaRef.current.y,
        maxZoomDelta: maxZoomDeltaRef.current,
      });
      return;
    }

    if (readOnly) return;
    setShowPicker(!wasPickerOpenRef.current);
    coverDebug('useCoverInteractionHandlers', 'interaction-end-click-toggle-picker', {
      nextPickerOpen: !wasPickerOpenRef.current,
      previousPickerOpen: wasPickerOpenRef.current,
      maxCropDeltaX: maxCropDeltaRef.current.x,
      maxCropDeltaY: maxCropDeltaRef.current.y,
      maxZoomDelta: maxZoomDeltaRef.current,
      dragThreshold: DRAG_THRESHOLD,
    });
  }, [readOnly, crop, zoom, saveToDb, setShowPicker, setIsInteracting]);

  const onCropperCropChange = useCallback((newCrop: { x: number; y: number }) => {
    if (readOnly) return;

    const clamped = clampCropToBounds(newCrop, cachedBounds);
    const dxFromStart = Math.abs(clamped.x - interactionStartCropRef.current.x);
    const dyFromStart = Math.abs(clamped.y - interactionStartCropRef.current.y);
    const dxFromCurrent = Math.abs(clamped.x - crop.x);
    const dyFromCurrent = Math.abs(clamped.y - crop.y);
    maxCropDeltaRef.current = {
      x: Math.max(maxCropDeltaRef.current.x, dxFromStart),
      y: Math.max(maxCropDeltaRef.current.y, dyFromStart),
    };

    if (dxFromCurrent > 0.001 || dyFromCurrent > 0.001) {
      setCrop(clamped);
    }
    if (dxFromStart > DRAG_THRESHOLD || dyFromStart > DRAG_THRESHOLD) {
      dragOccurredRef.current = true;
      if (!dragDetectedLoggedRef.current) {
        dragDetectedLoggedRef.current = true;
        coverDebug('useCoverInteractionHandlers', 'drag-threshold-crossed', {
          dxFromStart,
          dyFromStart,
          dragThreshold: DRAG_THRESHOLD,
        });
      }
    }
  }, [readOnly, cachedBounds, crop, setCrop]);

  const onCropperZoomChange = useCallback((newZoom: number) => {
    if (readOnly) return;

    const clampedZoom = Math.max(newZoom, effectiveMinZoom);
    if (Math.abs(clampedZoom - zoom) > 0.0001) {
      setZoom(clampedZoom);
    }
    const zoomDelta = Math.abs(clampedZoom - interactionStartZoomRef.current);
    maxZoomDeltaRef.current = Math.max(maxZoomDeltaRef.current, zoomDelta);
    if (zoomDelta > 0.01) {
      dragOccurredRef.current = true;
      if (!dragDetectedLoggedRef.current) {
        dragDetectedLoggedRef.current = true;
        coverDebug('useCoverInteractionHandlers', 'zoom-threshold-crossed', {
          zoomDelta,
          threshold: 0.01,
        });
      }
    }
  }, [readOnly, effectiveMinZoom, zoom, setZoom]);

  return {
    handleInteractionStart,
    handleInteractionEnd,
    onCropperCropChange,
    onCropperZoomChange,
  };
}
