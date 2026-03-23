import { useMemo } from 'react';
import { MAX_SCALE } from '../../../../utils/coverConstants';
import {
  calculateTranslateBounds,
  clampCropToBounds,
  resolveCoverObjectFitMode,
} from './coverInteractionMath';
import { useCoverInteractionPersistence } from './useCoverInteractionPersistence';
import { useCoverInteractionHandlers } from './useCoverInteractionHandlers';

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
  ignoreCropSyncRef: React.MutableRefObject<boolean>;
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
  setShowPicker,
  ignoreCropSyncRef,
}: UseCoverInteractionProps) {
  const effectiveMinZoom = 1;
  const effectiveMaxZoom = MAX_SCALE;

  const objectFitMode: 'contain' | 'horizontal-cover' | 'vertical-cover' = useMemo(
    () => resolveCoverObjectFitMode(mediaSize, effectiveContainerSize),
    [mediaSize, effectiveContainerSize]
  );

  const cachedBounds = useMemo(
    () => calculateTranslateBounds(mediaSize, effectiveContainerSize, zoom),
    [mediaSize, effectiveContainerSize, zoom]
  );

  const clampCropForZoom = useMemo(() => {
    return (nextCrop: { x: number; y: number }, nextZoom: number) => {
      const nextBounds = calculateTranslateBounds(mediaSize, effectiveContainerSize, nextZoom);
      return clampCropToBounds(nextCrop, nextBounds);
    };
  }, [mediaSize, effectiveContainerSize]);

  const { saveToDb } = useCoverInteractionPersistence({
    mediaSize,
    effectiveContainerSize,
    url,
    coverHeight,
    onUpdate,
  });

  const {
    handleInteractionStart,
    handleInteractionEnd,
    onCropperCropChange,
    onCropperZoomChange,
    markPointerIntent,
    markPointerMoveIntent,
    markNonPointerIntent,
  } = useCoverInteractionHandlers({
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
    markPointerMoveIntent,
    markNonPointerIntent,
    saveToDb
  };
}
