import { useLayoutEffect } from 'react';
import { DEFAULT_SCALE } from '../../../utils/coverUtils';

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
    setCrop({ x: 0, y: 0 });
    setZoom(DEFAULT_SCALE);
    setIsImageReady(false);
  }, [previewSrc, setCrop, setZoom, setIsImageReady]);
}
