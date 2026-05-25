export interface CropParams {
  x: number;
  y: number;
  width: number;
  height: number;
  ratio: number;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function normalizeImageWidth(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === 'auto') return null;
  const percent = trimmed.match(/^(\d+(?:\.\d+)?)%$/);
  if (percent) {
    return `${clampNumber(Number(percent[1]), 10, 100)}%`;
  }

  const px = trimmed.match(/^(\d+(?:\.\d+)?)px$/);
  if (px) {
    return `${clampNumber(Number(px[1]), 50, 2000)}px`;
  }

  return null;
}

function normalizeCropParams(value: Partial<CropParams> | null | undefined): CropParams | null {
  if (!value) return null;
  const { x, y, width, height, ratio } = value;
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(width) ||
    !Number.isFinite(height)
  ) {
    return null;
  }

  return {
    x: clampNumber(Number(x), 0, 100),
    y: clampNumber(Number(y), 0, 100),
    width: clampNumber(Number(width), 1, 100),
    height: clampNumber(Number(height), 1, 100),
    ratio: Number.isFinite(ratio) ? clampNumber(Number(ratio), 0.05, 20) : 1,
  };
}

export function parseCropValue(value: unknown): CropParams | null {
  if (typeof value === 'object' && value !== null) {
    return normalizeCropParams(value as Partial<CropParams>);
  }

  if (typeof value !== 'string') return null;
  const parts = value.split(',').map(Number);
  if (parts.length < 4) return null;
  return normalizeCropParams({
    x: parts[0],
    y: parts[1],
    width: parts[2],
    height: parts[3],
    ratio: parts[4],
  });
}

export function serializeCropValue(value: unknown): string | null {
  const crop = parseCropValue(value);
  if (!crop) return null;
  return `${crop.x.toFixed(6)},${crop.y.toFixed(6)},${crop.width.toFixed(6)},${crop.height.toFixed(6)},${crop.ratio.toFixed(6)}`;
}
