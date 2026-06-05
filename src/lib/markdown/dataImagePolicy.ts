export const MAX_INLINE_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_INLINE_IMAGE_BASE64_CHARS = Math.ceil(MAX_INLINE_IMAGE_BYTES / 3) * 4;

const SAFE_RASTER_DATA_IMAGE_PATTERN = /^(data:image\/(?:png|jpeg|jpg|webp|gif|bmp|avif);base64,)([A-Za-z0-9+/=]+)$/i;

export function getBase64DecodedByteLength(payload: string): number | null {
  if (payload.length % 4 === 1 || !/^[A-Za-z0-9+/]*={0,2}$/.test(payload)) {
    return null;
  }

  let padding = 0;
  if (payload.endsWith('==')) {
    padding = 2;
  } else if (payload.endsWith('=')) {
    padding = 1;
  }

  const byteLength = Math.floor((payload.length * 3) / 4) - padding;
  return byteLength >= 0 ? byteLength : null;
}

export function normalizeSafeRasterDataImageSrc(src: string | null | undefined): string | null {
  if (!src) {
    return null;
  }

  const trimmed = src.trim();
  const commaIndex = trimmed.indexOf(',');
  if (commaIndex < 0 || trimmed.length - commaIndex - 1 > MAX_INLINE_IMAGE_BASE64_CHARS) {
    return null;
  }

  const match = SAFE_RASTER_DATA_IMAGE_PATTERN.exec(trimmed);
  if (!match) {
    return null;
  }

  const byteLength = getBase64DecodedByteLength(match[2]);
  if (byteLength === null || byteLength > MAX_INLINE_IMAGE_BYTES) {
    return null;
  }

  return `${match[1].toLowerCase()}${match[2]}`;
}
