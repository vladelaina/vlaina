import { useCallback, useRef } from 'react';
import { clampCropToBounds, type TranslateBounds } from './coverInteractionMath';
import { DRAG_THRESHOLD } from '../../../../utils/coverConstants';

interface UseCoverInteractionHandlersProps {
  readOnly: boolean;
  cachedBounds: TranslateBounds;
  clampCropForZoom: (crop: { x: number; y: number }, zoom: number) => { x: number; y: number };
  effectiveMinZoom: number;
  setCrop: (crop: { x: number; y: number }) => void;
  setZoom: (zoom: number) => void;
  setIsInteracting: (interacting: boolean) => void;
  showPicker: boolean;
  setShowPicker: (show: boolean) => void;
  crop: { x: number; y: number };
  zoom: number;
  saveToDb: (crop: { x: number; y: number }, zoom: number) => void;
  ignoreCropSyncRef: React.MutableRefObject<boolean>;
}

export function useCoverInteractionHandlers({
  readOnly,
  cachedBounds,
  clampCropForZoom,
  effectiveMinZoom,
  setCrop,
  setZoom,
  setIsInteracting,
  showPicker,
  setShowPicker,
  crop,
  zoom,
  saveToDb,
  ignoreCropSyncRef,
}: UseCoverInteractionHandlersProps) {
  const dragOccurredRef = useRef(false);
  const nonPointerChangeRef = useRef(false);
  const pointerMovedRef = useRef(false);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const wasPickerOpenRef = useRef(false);
  const interactionStartCropRef = useRef(crop);
  const interactionStartZoomRef = useRef(zoom);
  const latestCropRef = useRef(crop);
  const latestZoomRef = useRef(zoom);
  const allowPickerToggleRef = useRef(false);
  const interactionIntentRef = useRef<'pointer' | 'non-pointer' | 'unknown'>('unknown');

  latestCropRef.current = crop;
  latestZoomRef.current = zoom;

  const handleInteractionStart = useCallback(() => {
    setIsInteracting(true);
    dragOccurredRef.current = false;
    nonPointerChangeRef.current = false;
    pointerMovedRef.current = false;
    wasPickerOpenRef.current = showPicker;
    interactionStartCropRef.current = crop;
    interactionStartZoomRef.current = zoom;
    allowPickerToggleRef.current = interactionIntentRef.current === 'pointer';
    interactionIntentRef.current = 'unknown';
  }, [showPicker, crop, zoom, setIsInteracting]);

  const handleInteractionEnd = useCallback(() => {
    setIsInteracting(false);

    if (dragOccurredRef.current || nonPointerChangeRef.current) {
      ignoreCropSyncRef.current = true;
      saveToDb(latestCropRef.current, latestZoomRef.current);
      pointerStartRef.current = null;
      return;
    }

    if (pointerMovedRef.current) {
      pointerStartRef.current = null;
      return;
    }

    if (readOnly) {
      pointerStartRef.current = null;
      return;
    }
    if (!allowPickerToggleRef.current) {
      pointerStartRef.current = null;
      return;
    }
    setShowPicker(!wasPickerOpenRef.current);
    pointerStartRef.current = null;
  }, [readOnly, saveToDb, setShowPicker, setIsInteracting, ignoreCropSyncRef]);

  const onCropperCropChange = useCallback((newCrop: { x: number; y: number }) => {
    if (readOnly) return;

    const clamped = clampCropToBounds(newCrop, cachedBounds);
    const dxFromStart = Math.abs(clamped.x - interactionStartCropRef.current.x);
    const dyFromStart = Math.abs(clamped.y - interactionStartCropRef.current.y);
    const dxFromCurrent = Math.abs(clamped.x - latestCropRef.current.x);
    const dyFromCurrent = Math.abs(clamped.y - latestCropRef.current.y);

    if (dxFromCurrent > 0.001 || dyFromCurrent > 0.001) {
      latestCropRef.current = clamped;
      setCrop(clamped);
    }
    if (dxFromStart > DRAG_THRESHOLD || dyFromStart > DRAG_THRESHOLD) {
      dragOccurredRef.current = true;
    }
    if (!allowPickerToggleRef.current && (dxFromStart > 0.001 || dyFromStart > 0.001)) {
      nonPointerChangeRef.current = true;
    }
  }, [readOnly, cachedBounds, setCrop]);

  const onCropperZoomChange = useCallback((newZoom: number) => {
    if (readOnly) return;

    const clampedZoom = Math.max(newZoom, effectiveMinZoom);
    const clampedCrop = clampCropForZoom(latestCropRef.current, clampedZoom);
    const cropChanged =
      Math.abs(clampedCrop.x - latestCropRef.current.x) > 0.001 ||
      Math.abs(clampedCrop.y - latestCropRef.current.y) > 0.001;

    if (cropChanged) {
      latestCropRef.current = clampedCrop;
      setCrop(clampedCrop);
    }
    if (Math.abs(clampedZoom - latestZoomRef.current) > 0.0001) {
      latestZoomRef.current = clampedZoom;
      setZoom(clampedZoom);
    }
    const zoomDelta = Math.abs(clampedZoom - interactionStartZoomRef.current);
    if (zoomDelta > 0.01) {
      dragOccurredRef.current = true;
    }
    if (!allowPickerToggleRef.current && zoomDelta > 0.0001) {
      nonPointerChangeRef.current = true;
    }
  }, [readOnly, clampCropForZoom, effectiveMinZoom, setCrop, setZoom]);

  const markPointerIntent = useCallback((x?: number, y?: number) => {
    interactionIntentRef.current = 'pointer';
    pointerMovedRef.current = false;
    if (typeof x === 'number' && typeof y === 'number') {
      pointerStartRef.current = { x, y };
    } else {
      pointerStartRef.current = null;
    }
  }, []);

  const markPointerMoveIntent = useCallback((x: number, y: number) => {
    if (!pointerStartRef.current) return;
    const dx = Math.abs(x - pointerStartRef.current.x);
    const dy = Math.abs(y - pointerStartRef.current.y);
    if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) {
      pointerMovedRef.current = true;
    }
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
    markPointerMoveIntent,
    markNonPointerIntent,
  };
}
