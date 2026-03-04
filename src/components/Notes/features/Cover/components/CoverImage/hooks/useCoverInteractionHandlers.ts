import { useCallback, useRef } from 'react';
import { clampCropToBounds, type TranslateBounds } from './coverInteractionMath';
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
  const nonPointerChangeRef = useRef(false);
  const wasPickerOpenRef = useRef(false);
  const interactionStartCropRef = useRef(crop);
  const interactionStartZoomRef = useRef(zoom);
  const allowPickerToggleRef = useRef(false);
  const interactionIntentRef = useRef<'pointer' | 'non-pointer' | 'unknown'>('unknown');

  const handleInteractionStart = useCallback(() => {
    setIsInteracting(true);
    dragOccurredRef.current = false;
    nonPointerChangeRef.current = false;
    wasPickerOpenRef.current = showPicker;
    interactionStartCropRef.current = crop;
    interactionStartZoomRef.current = zoom;
    allowPickerToggleRef.current = interactionIntentRef.current === 'pointer';
    interactionIntentRef.current = 'unknown';
  }, [showPicker, crop, zoom, setIsInteracting]);

  const handleInteractionEnd = useCallback(() => {
    setIsInteracting(false);

    if (dragOccurredRef.current || nonPointerChangeRef.current) {
      saveToDb(crop, zoom);
      return;
    }

    if (readOnly) return;
    if (!allowPickerToggleRef.current) return;
    setShowPicker(!wasPickerOpenRef.current);
  }, [readOnly, crop, zoom, saveToDb, setShowPicker, setIsInteracting]);

  const onCropperCropChange = useCallback((newCrop: { x: number; y: number }) => {
    if (readOnly || showPicker) return;

    const clamped = clampCropToBounds(newCrop, cachedBounds);
    const dxFromStart = Math.abs(clamped.x - interactionStartCropRef.current.x);
    const dyFromStart = Math.abs(clamped.y - interactionStartCropRef.current.y);
    const dxFromCurrent = Math.abs(clamped.x - crop.x);
    const dyFromCurrent = Math.abs(clamped.y - crop.y);

    if (dxFromCurrent > 0.001 || dyFromCurrent > 0.001) {
      setCrop(clamped);
    }
    if (dxFromStart > DRAG_THRESHOLD || dyFromStart > DRAG_THRESHOLD) {
      dragOccurredRef.current = true;
    }
    if (!allowPickerToggleRef.current && (dxFromStart > 0.001 || dyFromStart > 0.001)) {
      nonPointerChangeRef.current = true;
    }
  }, [readOnly, showPicker, cachedBounds, crop, setCrop]);

  const onCropperZoomChange = useCallback((newZoom: number) => {
    if (readOnly || showPicker) return;

    const clampedZoom = Math.max(newZoom, effectiveMinZoom);
    if (Math.abs(clampedZoom - zoom) > 0.0001) {
      setZoom(clampedZoom);
    }
    const zoomDelta = Math.abs(clampedZoom - interactionStartZoomRef.current);
    if (zoomDelta > 0.01) {
      dragOccurredRef.current = true;
    }
    if (!allowPickerToggleRef.current && zoomDelta > 0.0001) {
      nonPointerChangeRef.current = true;
    }
  }, [readOnly, showPicker, effectiveMinZoom, zoom, setZoom]);

  const markPointerIntent = useCallback(() => {
    interactionIntentRef.current = 'pointer';
  }, []);

  const markNonPointerIntent = useCallback(() => {
    if (interactionIntentRef.current !== 'pointer') {
      interactionIntentRef.current = 'non-pointer';
    }
  }, []);

  return {
    handleInteractionStart,
    handleInteractionEnd,
    onCropperCropChange,
    onCropperZoomChange,
    markPointerIntent,
    markNonPointerIntent,
  };
}
