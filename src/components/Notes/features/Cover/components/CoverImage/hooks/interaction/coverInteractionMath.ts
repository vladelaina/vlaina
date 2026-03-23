import { getBaseDimensions } from '../../../../utils/coverGeometry';

interface Size {
  width: number;
  height: number;
}

interface Point {
  x: number;
  y: number;
}

export interface TranslateBounds {
  maxTranslateX: number;
  maxTranslateY: number;
}

export function resolveCoverObjectFitMode(
  mediaSize: Size | null,
  containerSize: Size | null
): 'contain' | 'horizontal-cover' | 'vertical-cover' {
  if (!mediaSize || !containerSize) return 'horizontal-cover';

  const imageAspect = mediaSize.width / mediaSize.height;
  const containerAspect = containerSize.width / containerSize.height;

  return imageAspect > containerAspect ? 'vertical-cover' : 'horizontal-cover';
}

export function calculateTranslateBounds(
  mediaSize: Size | null,
  containerSize: Size | null,
  zoom: number
): TranslateBounds {
  if (!mediaSize || !containerSize) {
    return { maxTranslateX: 0, maxTranslateY: 0 };
  }

  const baseDims = getBaseDimensions(mediaSize, containerSize);
  const scaledWidth = baseDims.width * zoom;
  const scaledHeight = baseDims.height * zoom;

  return {
    maxTranslateX: Math.max(0, (scaledWidth - containerSize.width) / 2),
    maxTranslateY: Math.max(0, (scaledHeight - containerSize.height) / 2),
  };
}

export function clampCropToBounds(crop: Point, bounds: TranslateBounds): Point {
  return {
    x: Math.max(-bounds.maxTranslateX, Math.min(bounds.maxTranslateX, crop.x)),
    y: Math.max(-bounds.maxTranslateY, Math.min(bounds.maxTranslateY, crop.y)),
  };
}
