import { useMemo, useCallback, useRef } from 'react';
import { 
  calculateCropPercentage, 
  getBaseDimensions, 
  MAX_SCALE 
} from '../../../utils/coverUtils';

interface UseCoverInteractionProps {
  mediaSize: { width: number; height: number } | null;
  effectiveContainerSize: { width: number; height: number } | null;
  zoom: number;
  setZoom: (zoom: number) => void;
  crop: { x: number; y: number };
  setCrop: (crop: { x: number; y: number }) => void;
  coverHeight: number;
  url: string | null;
  readOnly: boolean;
  onUpdate: (url: string | null, x: number, y: number, h?: number, s?: number) => void;
  setIsInteracting: (interacting: boolean) => void;
  showPicker: boolean;
  setShowPicker: (show: boolean) => void;
}

export function useCoverInteraction({
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
  setShowPicker
}: UseCoverInteractionProps) {

  const effectiveMinZoom = 1;
  const effectiveMaxZoom = MAX_SCALE;

  // Object Fit Mode Logic
  const objectFitMode: 'contain' | 'horizontal-cover' | 'vertical-cover' = useMemo(() => {
    if (!mediaSize || !effectiveContainerSize) return 'horizontal-cover';
    const imageAspect = mediaSize.width / mediaSize.height;
    const containerAspect = effectiveContainerSize.width / effectiveContainerSize.height;

    if (Math.abs(imageAspect - containerAspect) < 0.01) {
      return 'horizontal-cover';
    }
    return imageAspect > containerAspect ? 'vertical-cover' : 'horizontal-cover';
  }, [mediaSize, effectiveContainerSize]);

  // Cached Bounds Logic
  const cachedBounds = useMemo(() => {
    if (!mediaSize || !effectiveContainerSize) {
      return { maxTranslateX: 0, maxTranslateY: 0 };
    }
    const baseDims = getBaseDimensions(mediaSize, effectiveContainerSize);
    const scaledW = baseDims.width * zoom;
    const scaledH = baseDims.height * zoom;

    return {
      maxTranslateX: Math.max(0, (scaledW - effectiveContainerSize.width) / 2),
      maxTranslateY: Math.max(0, (scaledH - effectiveContainerSize.height) / 2),
    };
  }, [mediaSize, effectiveContainerSize, zoom]);

  // Save Logic
  const saveToDb = useCallback((currentCrop: { x: number, y: number }, currentZoom: number) => {
    if (!mediaSize || !effectiveContainerSize) return;

    const percent = calculateCropPercentage(
      currentCrop,
      mediaSize,
      effectiveContainerSize,
      currentZoom
    );

    onUpdate(url, percent.x, percent.y, coverHeight, currentZoom);
  }, [mediaSize, effectiveContainerSize, url, coverHeight, onUpdate]);

  // Interaction Handlers
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
    } else if (!readOnly && !wasPickerOpenRef.current) {
      setShowPicker(true);
    } else if (!readOnly && wasPickerOpenRef.current) {
      setShowPicker(false);
    }
  }, [readOnly, crop, zoom, saveToDb, setShowPicker, setIsInteracting]);

  const onCropperCropChange = useCallback((newCrop: { x: number, y: number }) => {
    if (readOnly) return;
    const { maxTranslateX, maxTranslateY } = cachedBounds;
    const clampedX = Math.max(-maxTranslateX, Math.min(maxTranslateX, newCrop.x));
    const clampedY = Math.max(-maxTranslateY, Math.min(maxTranslateY, newCrop.y));
    
    setCrop({ x: clampedX, y: clampedY });
    dragOccurredRef.current = true;
  }, [readOnly, cachedBounds, setCrop]);

  const onCropperZoomChange = useCallback((newZoom: number) => {
    if (readOnly) return;
    const safeZoom = Math.max(newZoom, effectiveMinZoom);
    setZoom(safeZoom);
    dragOccurredRef.current = true;
  }, [readOnly, effectiveMinZoom, setZoom]);

  return {
    objectFitMode,
    effectiveMinZoom,
    effectiveMaxZoom,
    handleInteractionStart,
    handleInteractionEnd,
    onCropperCropChange,
    onCropperZoomChange,
    saveToDb
  };
}
