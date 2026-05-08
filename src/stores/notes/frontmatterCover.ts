import type { NoteCoverMetadata } from './types';

const MIN_COVER_HEIGHT = 120;
const MAX_COVER_HEIGHT = 500;
const MIN_COVER_SCALE = 1;
const MAX_COVER_SCALE = 10;

function clampFiniteNumber(value: number | undefined, min: number, max: number): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }
  return Math.max(min, Math.min(max, value));
}

export function normalizeNoteCoverMetadata(
  cover: NoteCoverMetadata | null | undefined
): NoteCoverMetadata | undefined {
  if (!cover?.assetPath) {
    return undefined;
  }

  const normalized: NoteCoverMetadata = {
    assetPath: cover.assetPath,
  };
  const positionX = clampFiniteNumber(cover.positionX, 0, 100);
  const positionY = clampFiniteNumber(cover.positionY, 0, 100);
  const height = clampFiniteNumber(cover.height, MIN_COVER_HEIGHT, MAX_COVER_HEIGHT);
  const scale = clampFiniteNumber(cover.scale, MIN_COVER_SCALE, MAX_COVER_SCALE);

  if (positionX !== undefined) normalized.positionX = positionX;
  if (positionY !== undefined) normalized.positionY = positionY;
  if (height !== undefined) normalized.height = height;
  if (scale !== undefined) normalized.scale = scale;

  return normalized;
}
