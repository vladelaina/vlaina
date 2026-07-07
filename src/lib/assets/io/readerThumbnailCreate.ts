import { toBlobPart } from '@/lib/blobPart';
import {
  isSvgImagePath,
  prepareImageBytes,
} from './readerImageShared';

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to decode image'));
    image.src = src;
  });
}

function createThumbnailBlobInWorker(
  bytes: Uint8Array,
  mimeType: string,
  maxEdgePx: number
): Promise<Blob> | null {
  if (
    typeof Worker === 'undefined' ||
    typeof Blob === 'undefined'
  ) {
    return null;
  }

  let worker: Worker;
  try {
    worker = new Worker(new URL('./imageThumbnail.worker.ts', import.meta.url), { type: 'module' });
  } catch (error) {
    return Promise.reject(error);
  }

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      worker.terminate();
    };
    worker.onmessage = (event: MessageEvent<{ ok: boolean; blob?: Blob; message?: string }>) => {
      cleanup();
      if (event.data?.ok && event.data.blob) {
        resolve(event.data.blob);
        return;
      }
      reject(new Error(event.data?.message || 'Failed to create thumbnail in worker'));
    };
    worker.onerror = (event) => {
      cleanup();
      reject(new Error(event.message || 'Thumbnail worker failed'));
    };
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    worker.postMessage({ buffer, mimeType, maxEdgePx }, [buffer]);
  });
}

export async function createThumbnailBlobUrl(
  fullPath: string,
  bytes: Uint8Array,
  mimeType: string,
  maxEdgePx: number,
  allowMainThreadFallback: boolean,
  onThumbnailBlob?: (blob: Blob) => void
): Promise<string> {
  if (isSvgImagePath(fullPath)) {
    const blob = new Blob([toBlobPart(prepareImageBytes(fullPath, bytes))], { type: mimeType });
    return URL.createObjectURL(blob);
  }

  const workerThumbnailPromise = createThumbnailBlobInWorker(bytes, mimeType, maxEdgePx);
  const workerThumbnailBlob = workerThumbnailPromise
    ? await workerThumbnailPromise.catch(() => null)
    : null;
  if (workerThumbnailBlob) {
    onThumbnailBlob?.(workerThumbnailBlob);
    return URL.createObjectURL(workerThumbnailBlob);
  }

  if (!allowMainThreadFallback) {
    const blob = new Blob([toBlobPart(bytes)], { type: mimeType });
    return URL.createObjectURL(blob);
  }

  const sourceBlob = new Blob([toBlobPart(bytes)], { type: mimeType });
  const sourceUrl = URL.createObjectURL(sourceBlob);

  try {
    const image = await loadImageElement(sourceUrl);
    const scale = Math.min(
      1,
      maxEdgePx / Math.max(image.naturalWidth || 1, image.naturalHeight || 1),
    );
    const width = Math.max(1, Math.round((image.naturalWidth || 1) * scale));
    const height = Math.max(1, Math.round((image.naturalHeight || 1) * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) {
      throw new Error('Canvas is unavailable');
    }
    context.drawImage(image, 0, 0, width, height);

    const thumbnailBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create thumbnail'));
        }
      }, 'image/webp', 0.82);
    });
    onThumbnailBlob?.(thumbnailBlob);

    return URL.createObjectURL(thumbnailBlob);
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}
