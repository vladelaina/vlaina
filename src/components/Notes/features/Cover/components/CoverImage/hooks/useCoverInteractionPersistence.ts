import { useCallback } from 'react';
import { calculateCropPercentage } from '../../../utils/coverUtils';

interface UseCoverInteractionPersistenceProps {
  mediaSize: { width: number; height: number } | null;
  effectiveContainerSize: { width: number; height: number } | null;
  url: string | null;
  coverHeight: number;
  onUpdate: (url: string | null, x: number, y: number, h?: number, s?: number) => void;
}

export function useCoverInteractionPersistence({
  mediaSize,
  effectiveContainerSize,
  url,
  coverHeight,
  onUpdate,
}: UseCoverInteractionPersistenceProps) {
  const saveToDb = useCallback((currentCrop: { x: number; y: number }, currentZoom: number) => {
    if (!mediaSize || !effectiveContainerSize) return;

    const percent = calculateCropPercentage(
      currentCrop,
      mediaSize,
      effectiveContainerSize,
      currentZoom
    );

    onUpdate(url, percent.x, percent.y, coverHeight, currentZoom);
  }, [mediaSize, effectiveContainerSize, url, coverHeight, onUpdate]);

  return { saveToDb };
}
