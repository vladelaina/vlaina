import { useLayoutEffect, type Dispatch, type SetStateAction } from 'react';
import { DEFAULT_SCALE } from '../../../../utils/coverConstants';
import { getCachedDimensions } from '../../../../utils/coverDimensionCache';

interface UseCoverPreviewResetProps {
  previewSrc: string | null;
  setCrop: Dispatch<SetStateAction<{ x: number; y: number }>>;
  setZoom: (zoom: number) => void;
  setIsImageReady: (ready: boolean) => void;
}

export function useCoverPreviewReset({
  previewSrc,
  setCrop,
  setZoom,
  setIsImageReady,
}: UseCoverPreviewResetProps) {
  useLayoutEffect(() => {
    if (!previewSrc) return;
    const cachedDimensions = getCachedDimensions(previewSrc);

    setCrop((currentCrop) => (
      currentCrop.x === 0 && currentCrop.y === 0 ? currentCrop : { x: 0, y: 0 }
    ));
    setZoom(DEFAULT_SCALE);

    if (cachedDimensions) {
      return;
    }

    setIsImageReady(false);
  }, [previewSrc, setCrop, setZoom, setIsImageReady]);
}
