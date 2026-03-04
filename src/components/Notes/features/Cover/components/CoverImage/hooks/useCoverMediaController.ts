import { useCoverMediaSync } from './useCoverMediaSync';

interface UseCoverMediaControllerProps {
  mediaSrc: string;
  effectiveContainerSize: { width: number; height: number } | null;
  isImageReady: boolean;
  syncPositionX: number;
  syncPositionY: number;
  syncZoom: number;
  setMediaSize: (size: { width: number; height: number }) => void;
  setCrop: (crop: { x: number; y: number }) => void;
  setZoom: (zoom: number) => void;
  setIsImageReady: (ready: boolean) => void;
  onSourceReady: (src: string) => void;
}

export function useCoverMediaController({
  mediaSrc,
  effectiveContainerSize,
  isImageReady,
  syncPositionX,
  syncPositionY,
  syncZoom,
  setMediaSize,
  setCrop,
  setZoom,
  setIsImageReady,
  onSourceReady,
}: UseCoverMediaControllerProps) {
  const { handleMediaLoaded } = useCoverMediaSync({
    currentSrc: mediaSrc,
    effectiveContainerSize,
    isImageReady,
    syncPositionX,
    syncPositionY,
    syncZoom,
    setMediaSize,
    setCrop,
    setZoom,
    setIsImageReady,
    onSourceReady,
  });

  return { handleMediaLoaded };
}
