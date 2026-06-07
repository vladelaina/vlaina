import type { NoteCoverMetadata } from './types';

const MIN_COVER_HEIGHT = 120;
const MAX_COVER_HEIGHT = 500;
const MIN_COVER_SCALE = 1;
const MAX_COVER_SCALE = 10;
const MAX_COVER_ASSET_PATH_CHARS = 16 * 1024;
const CONTROL_OR_BIDI_PATTERN = /[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069\uFFFD]/;
const EXPLICIT_URL_SCHEME_PATTERN = /^[A-Za-z][A-Za-z0-9+.-]*:/;
const WINDOWS_ABSOLUTE_PATH_PATTERN = /^[A-Za-z]:[\\/]/;

function clampFiniteNumber(value: number | undefined, min: number, max: number): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }
  return Math.max(min, Math.min(max, value));
}

function normalizeCoverAssetPath(value: string): string | null {
  const trimmed = value.trim();
  if (
    !trimmed
    || trimmed.length > MAX_COVER_ASSET_PATH_CHARS
    || CONTROL_OR_BIDI_PATTERN.test(trimmed)
    || trimmed.startsWith('/')
    || trimmed.startsWith('\\')
    || trimmed.startsWith('//')
    || WINDOWS_ABSOLUTE_PATH_PATTERN.test(trimmed)
    || EXPLICIT_URL_SCHEME_PATTERN.test(trimmed)
  ) {
    return null;
  }
  return trimmed;
}

export function normalizeNoteCoverMetadata(
  cover: NoteCoverMetadata | null | undefined
): NoteCoverMetadata | undefined {
  if (!cover?.assetPath) {
    return undefined;
  }

  const assetPath = normalizeCoverAssetPath(cover.assetPath);
  if (!assetPath) {
    return undefined;
  }

  const normalized: NoteCoverMetadata = {
    assetPath,
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
