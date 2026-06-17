import { sanitizeSvgMarkup } from '@/lib/markdown/svgSanitizer';
import {
  getBase64DecodedByteLength,
  MAX_INLINE_IMAGE_BYTES,
  normalizeSafeRasterDataImageSrc,
} from '@/lib/markdown/dataImagePolicy';
import { toBlobPart } from '@/lib/blobPart';

const SVG_RASTERIZE_TIMEOUT_MS = 2500;
export const MAX_PENDING_SVG_RASTERIZATIONS = 32;
const SVG_DIMENSION_NUMBER_PATTERN = /^(?:\d+(?:\.\d+)?|\.\d+)$/;
const pendingSvgRasterizations = new Map<string, Promise<string | null>>();

function decodeSvgDataUrl(dataUrl: string): string | null {
  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex < 0) {
    return null;
  }
  const meta = dataUrl.slice(0, commaIndex);
  const payload = dataUrl.slice(commaIndex + 1);
  try {
    if (/;base64/i.test(meta)) {
      const byteLength = getBase64DecodedByteLength(payload);
      if (byteLength === null || byteLength > MAX_INLINE_IMAGE_BYTES) {
        return null;
      }
      const decoded = window.atob(payload);
      return decoded.length <= MAX_INLINE_IMAGE_BYTES ? decoded : null;
    }
    if (payload.length > MAX_INLINE_IMAGE_BYTES * 3) {
      return null;
    }
    const decoded = decodeURIComponent(payload);
    return new TextEncoder().encode(decoded).byteLength <= MAX_INLINE_IMAGE_BYTES ? decoded : null;
  } catch {
    return null;
  }
}

function pickSvgRenderSize(svgText: string): { width: number; height: number } {
  const clamp = (value: number) => Math.max(1, Math.min(4096, Math.round(value)));
  const parsePositive = (value: string | undefined) => {
    if (!value) return null;
    const trimmed = value.trim();
    if (!SVG_DIMENSION_NUMBER_PATTERN.test(trimmed)) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };

  const widthMatch = /\bwidth=["']\s*([0-9.]+)(?:px)?\s*["']/i.exec(svgText);
  const heightMatch = /\bheight=["']\s*([0-9.]+)(?:px)?\s*["']/i.exec(svgText);
  const widthFromAttr = parsePositive(widthMatch?.[1]);
  const heightFromAttr = parsePositive(heightMatch?.[1]);
  if (widthFromAttr && heightFromAttr) {
    return { width: clamp(widthFromAttr), height: clamp(heightFromAttr) };
  }

  const viewBoxMatch = /\bviewBox=["']\s*[-0-9.]+\s+[-0-9.]+\s+([0-9.]+)\s+([0-9.]+)\s*["']/i.exec(svgText);
  const widthFromViewBox = parsePositive(viewBoxMatch?.[1]);
  const heightFromViewBox = parsePositive(viewBoxMatch?.[2]);
  if (widthFromViewBox && heightFromViewBox) {
    return { width: clamp(widthFromViewBox), height: clamp(heightFromViewBox) };
  }

  return { width: 1024, height: 1024 };
}

function sanitizeSvgDataUrl(dataUrl: string): { dataUrl: string; svgText: string } | null {
  const svgText = decodeSvgDataUrl(dataUrl);
  if (!svgText) {
    return null;
  }

  const sanitized = sanitizeSvgMarkup(svgText);
  if (!sanitized) {
    return null;
  }

  return {
    dataUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sanitized)}`,
    svgText: sanitized,
  };
}

export function isSvgDataUrl(value: unknown): boolean {
  return typeof value === 'string' && /^data:image\/svg\+xml(?:[;,]|$)/i.test(value.trim());
}

export function isSvgImageMimeType(value: unknown): boolean {
  return typeof value === 'string' && value.split(';')[0]?.trim().toLowerCase() === 'image/svg+xml';
}

function uint8ArrayToBase64(data: Uint8Array): string {
  const CHUNK_SIZE = 0x8000;
  let binary = '';
  for (let i = 0; i < data.length; i += CHUNK_SIZE) {
    const chunk = data.subarray(i, i + CHUNK_SIZE);
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return window.btoa(binary);
}

function isBlobByteLengthWithinLimit(size: number, maxBytes: number): boolean {
  return Number.isFinite(size) && size >= 0 && size <= maxBytes;
}

function blobToDataUrl(blob: Blob): Promise<string | null> {
  return blob.arrayBuffer().then((buffer) => {
    if (!isBlobByteLengthWithinLimit(buffer.byteLength, MAX_INLINE_IMAGE_BYTES)) {
      return null;
    }
    const mimeType = isSvgImageMimeType(blob.type) ? blob.type : 'image/svg+xml';
    return `data:${mimeType};base64,${uint8ArrayToBase64(new Uint8Array(buffer))}`;
  });
}

function dataUrlToBlob(dataUrl: string): Blob | null {
  const match = /^data:([^;,]+)(;base64)?,(.*)$/i.exec(dataUrl.trim());
  if (!match) {
    return null;
  }

  const mimeType = match[1]?.trim().toLowerCase() || 'application/octet-stream';
  const payload = match[3] || '';
  try {
    if (match[2]) {
      const binary = window.atob(payload);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }
      return new Blob([toBlobPart(bytes)], { type: mimeType });
    }
    return new Blob([decodeURIComponent(payload)], { type: mimeType });
  } catch {
    return null;
  }
}

export async function rasterizeSvgBlobToPngBlob(blob: Blob): Promise<Blob | null> {
  if (!isSvgImageMimeType(blob.type)) {
    return blob;
  }
  if (!isBlobByteLengthWithinLimit(blob.size, MAX_INLINE_IMAGE_BYTES)) {
    return null;
  }

  const svgDataUrl = await blobToDataUrl(blob);
  if (!svgDataUrl) {
    return null;
  }
  const rasterizedDataUrl = await rasterizeSvgDataUrlToPng(svgDataUrl);
  if (!rasterizedDataUrl || isSvgDataUrl(rasterizedDataUrl)) {
    return null;
  }
  return dataUrlToBlob(rasterizedDataUrl);
}

export function clearSvgRasterizeState(): void {
  pendingSvgRasterizations.clear();
}

export function getPendingSvgRasterizeCount(): number {
  return pendingSvgRasterizations.size;
}

function rasterizeSvgDataUrlToPngUncached(dataUrl: string): Promise<string | null> {
  if (typeof dataUrl !== 'string') {
    return Promise.resolve(null);
  }
  if (!isSvgDataUrl(dataUrl)) {
    return Promise.resolve(dataUrl);
  }
  if (typeof window === 'undefined' || typeof Image === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve(null);
  }

  const sanitizedSvg = sanitizeSvgDataUrl(dataUrl);
  if (!sanitizedSvg) {
    return Promise.resolve(null);
  }
  const { width, height } = pickSvgRenderSize(sanitizedSvg.svgText);

  return new Promise((resolve) => {
    let settled = false;
    const timeout = window.setTimeout(() => finish(null), SVG_RASTERIZE_TIMEOUT_MS);
    const finish = (value: string | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      resolve(value);
    };

    const image = new Image();
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          finish(null);
          return;
        }
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(image, 0, 0, width, height);
        finish(normalizeSafeRasterDataImageSrc(canvas.toDataURL('image/png')));
      } catch {
        finish(null);
      }
    };
    image.onerror = () => finish(null);
    image.src = sanitizedSvg.dataUrl;
  });
}

export function rasterizeSvgDataUrlToPng(dataUrl: string): Promise<string | null> {
  if (typeof dataUrl !== 'string') {
    return Promise.resolve(null);
  }
  if (!isSvgDataUrl(dataUrl)) {
    return Promise.resolve(dataUrl);
  }

  const existingPromise = pendingSvgRasterizations.get(dataUrl);
  if (existingPromise) {
    return existingPromise;
  }
  if (pendingSvgRasterizations.size >= MAX_PENDING_SVG_RASTERIZATIONS) {
    return Promise.resolve(null);
  }

  const promise = rasterizeSvgDataUrlToPngUncached(dataUrl).finally(() => {
    pendingSvgRasterizations.delete(dataUrl);
  });
  pendingSvgRasterizations.set(dataUrl, promise);
  return promise;
}
