import { useCallback, useRef } from 'react';
import { clampCropToBounds, type TranslateBounds } from './coverInteractionMath';

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

  const handleInteractionStart = useCallback(() => {
    setIsInteracting(true);
    dragOccurredRef.current = false;
    wasPickerOpenRef.current = showPicker;
  }, [showPicker, setIsInteracting]);

  const handleInteractionEnd = useCallback(() => {
    setIsInteracting(false);

    if (dragOccurredRef.current) {
      saveToDb(crop, zoom);
      return;
    }

    if (readOnly) return;
    setShowPicker(!wasPickerOpenRef.current);
  }, [readOnly, crop, zoom, saveToDb, setShowPicker, setIsInteracting]);

  const onCropperCropChange = useCallback((newCrop: { x: number; y: number }) => {
    if (readOnly) return;
    setCrop(clampCropToBounds(newCrop, cachedBounds));
    dragOccurredRef.current = true;
  }, [readOnly, cachedBounds, setCrop]);

  const onCropperZoomChange = useCallback((newZoom: number) => {
    if (readOnly) return;
    setZoom(Math.max(newZoom, effectiveMinZoom));
    dragOccurredRef.current = true;
  }, [readOnly, effectiveMinZoom, setZoom]);

  return {
    handleInteractionStart,
    handleInteractionEnd,
    onCropperCropChange,
    onCropperZoomChange,
  };
}
