import { useMemo } from 'react';
import { MAX_SCALE } from '../../../utils/coverUtils';
import {
  calculateTranslateBounds,
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

  const objectFitMode: 'contain' | 'horizontal-cover' | 'vertical-cover' = useMemo(
    () => resolveCoverObjectFitMode(mediaSize, effectiveContainerSize),
    [mediaSize, effectiveContainerSize]
  );

  const cachedBounds = useMemo(
    () => calculateTranslateBounds(mediaSize, effectiveContainerSize, zoom),
    [mediaSize, effectiveContainerSize, zoom]
  );

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
  } = useCoverInteractionHandlers({
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
  });

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
