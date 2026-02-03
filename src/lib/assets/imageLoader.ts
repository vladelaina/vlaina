import { getStorageAdapter } from '@/lib/storage/adapter';
import { getMimeType } from './filenameService';

const MAX_CACHE_SIZE = 500;
const blobUrlCache = new Map<string, string>();

export async function loadImageAsBlob(fullPath: string): Promise<string> {
  const cached = blobUrlCache.get(fullPath);
  if (cached) {
    blobUrlCache.delete(fullPath);
    blobUrlCache.set(fullPath, cached);
    return cached;
  }

  const storage = getStorageAdapter();

  try {
    const data = await storage.readBinaryFile(fullPath);
    const mimeType = getMimeType(fullPath);
    const copy = new Uint8Array(data);
    const blob = new Blob([copy], { type: mimeType });
    const blobUrl = URL.createObjectURL(blob);

    if (blobUrlCache.size >= MAX_CACHE_SIZE) {
      const oldestKey = blobUrlCache.keys().next().value;
      if (oldestKey) {
        const oldestUrl = blobUrlCache.get(oldestKey);
        if (oldestUrl) URL.revokeObjectURL(oldestUrl);
        blobUrlCache.delete(oldestKey);
      }
    }

    blobUrlCache.set(fullPath, blobUrl);

    return blobUrl;
  } catch (error) {
    console.error('Failed to load image:', fullPath, error);
    throw error;
  }
}

export async function loadImageAsBase64(fullPath: string): Promise<string> {
  const storage = getStorageAdapter();

  try {
    const data = await storage.readBinaryFile(fullPath);
    const mimeType = getMimeType(fullPath);

    const copy = new Uint8Array(data);
    const blob = new Blob([copy], { type: mimeType });

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result;
        if (typeof result === 'string') {
          resolve(result);
        } else {
          reject(new Error('Failed to convert image to base64'));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });


  } catch (error) {
    console.error('Failed to load image as base64:', fullPath, error);
    throw error;
  }
}

export function revokeImageBlob(fullPath: string): void {
  const cached = blobUrlCache.get(fullPath);
  if (cached) {
    URL.revokeObjectURL(cached);
    blobUrlCache.delete(fullPath);
  }
}

export function invalidateImageCache(fullPath: string): void {
  blobUrlCache.delete(fullPath);
}

export function clearImageCache(): void {
  for (const url of blobUrlCache.values()) {
    URL.revokeObjectURL(url);
  }
  blobUrlCache.clear();
}

export function getCachedBlobUrl(fullPath: string): string | undefined {
  const cached = blobUrlCache.get(fullPath);
  
  if (cached) {
    blobUrlCache.delete(fullPath);
    blobUrlCache.set(fullPath, cached);
  }
  return cached;
}

export async function getCroppedImg(
  imageSrc: string,
  pixelCrop: { x: number; y: number; width: number; height: number },
  maxDimension: number = 256 // Default to 256 for backward compatibility (icons)
): Promise<Blob | null> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return null;
  }

  let scale = 1;
  if (maxDimension > 0 && maxDimension < Infinity) {
    scale = Math.min(1, maxDimension / Math.max(pixelCrop.width, pixelCrop.height));
  }

  canvas.width = pixelCrop.width * scale;
  canvas.height = pixelCrop.height * scale;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    canvas.width,
    canvas.height
  );

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob);
    }, 'image/png');
  });
}

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous'); // needed to avoid CORS issues on some images
    image.src = url;
  });
}
