import { useLayoutEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import { DEFAULT_SCALE } from '../../../../utils/coverConstants';
import { getCachedDimensions } from '../../../../utils/coverDimensionCache';

interface UseCoverPreviewResetProps {
  previewSrc: string | null;
  scale: number;
  setCrop: Dispatch<SetStateAction<{ x: number; y: number }>>;
  setZoom: (zoom: number) => void;
  setIsImageReady: (ready: boolean) => void;
}

export function useCoverPreviewReset({
  previewSrc,
  scale,
  setCrop,
  setZoom,
  setIsImageReady,
}: UseCoverPreviewResetProps) {
  const wasPreviewingRef = useRef(false);

  useLayoutEffect(() => {
    if (!previewSrc) {
      if (wasPreviewingRef.current) {
        wasPreviewingRef.current = false;
        setZoom(scale);
      }
      return;
    }
    wasPreviewingRef.current = true;
    const cachedDimensions = getCachedDimensions(previewSrc);

    setCrop((currentCrop) => (
      currentCrop.x === 0 && currentCrop.y === 0 ? currentCrop : { x: 0, y: 0 }
    ));
    setZoom(DEFAULT_SCALE);

    if (cachedDimensions) {
      return;
    }

    setIsImageReady(false);
  }, [previewSrc, scale, setCrop, setZoom, setIsImageReady]);
}
