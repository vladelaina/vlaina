import { useLayoutEffect } from 'react';
import { DEFAULT_SCALE } from '../../../../utils/coverConstants';
import { getCachedDimensions } from '../../../../utils/coverDimensionCache';

interface UseCoverPreviewResetProps {
  previewSrc: string | null;
  setCrop: (crop: { x: number; y: number }) => void;
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

    setCrop({ x: 0, y: 0 });
    setZoom(DEFAULT_SCALE);

    if (cachedDimensions) {
      return;
    }

    setIsImageReady(false);
  }, [previewSrc, setCrop, setZoom, setIsImageReady]);
}
