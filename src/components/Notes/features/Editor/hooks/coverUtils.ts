
export const MIN_HEIGHT = 120;
export const MAX_HEIGHT = 500;
export const DEFAULT_HEIGHT = 255;
export const MAX_SCALE = 10;
export const DRAG_THRESHOLD = 5;
export const SAVE_DEBOUNCE_MS = 200;

// Calculate image dimensions for cover-fit display
export function calcImageDimensions(
    containerW: number,
    containerH: number,
    imgW: number,
    imgH: number,
    scale: number
) {
    const containerRatio = containerW / containerH;
    const imgRatio = imgW / imgH;

    let baseW: number, baseH: number;
    if (imgRatio > containerRatio) {
        baseH = containerH;
        baseW = containerH * imgRatio;
    } else {
        baseW = containerW;
        baseH = containerW / imgRatio;
    }

    return {
        width: baseW * scale,
        height: baseH * scale,
        overflowX: baseW * scale - containerW,
        overflowY: baseH * scale - containerH,
    };
}

const dimensionCache = new Map<string, { width: number; height: number }>();

export function getCachedDimensions(src: string) {
    return dimensionCache.get(src);
}

// Load image and get its natural dimensions
export async function loadImageWithDimensions(src: string): Promise<{ width: number; height: number } | null> {
    const cached = dimensionCache.get(src);
    if (cached) return cached;

    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const dims = { width: img.naturalWidth, height: img.naturalHeight };
            dimensionCache.set(src, dims);
            resolve(dims);
        };
        img.onerror = () => resolve(null);
        img.src = src;
    });
}
// ... existing exports ...

interface Size { width: number; height: number; }
interface Point { x: number; y: number; }

/**
 * Convert Database Percentage Position (0-100) to React-Easy-Crop Pixel Offset
 */
export function calculateCropPixels(
    positionPercent: Point,
    mediaSize: Size,
    containerSize: Size,
    zoom: number
): Point {
    const scaledW = mediaSize.width * zoom;
    const scaledH = mediaSize.height * zoom;

    // Max translation allowed (dragging to edge)
    // Positive value means the image edge is aligned with container edge
    const maxTranslateX = (scaledW - containerSize.width) / 2;
    const maxTranslateY = (scaledH - containerSize.height) / 2;

    // Map 0-100% to +Max -> -Max translation
    // 50% -> 0 (Center)
    // 0%  -> +Max (Left/Top Edge)
    // 100% -> -Max (Right/Bottom Edge)

    const x = ((50 - positionPercent.x) / 50) * maxTranslateX;
    const y = ((50 - positionPercent.y) / 50) * maxTranslateY;

    return { x, y };
}

/**
 * Convert React-Easy-Crop Pixel Offset to Database Percentage Position (0-100)
 */
export function calculateCropPercentage(
    cropPixels: Point,
    mediaSize: Size,
    containerSize: Size,
    zoom: number
): Point {
    const scaledW = mediaSize.width * zoom;
    const scaledH = mediaSize.height * zoom;

    const maxTranslateX = (scaledW - containerSize.width) / 2;
    const maxTranslateY = (scaledH - containerSize.height) / 2;

    let x = 50;
    if (maxTranslateX > 0) {
        // Reverse: Translate = ((50 - P) / 50) * Max
        // Translate / Max * 50 = 50 - P
        // P = 50 - (Translate / Max * 50)
        x = 50 - (cropPixels.x / maxTranslateX * 50);
    }

    let y = 50;
    if (maxTranslateY > 0) {
        y = 50 - (cropPixels.y / maxTranslateY * 50);
    }

    return {
        x: Math.max(0, Math.min(100, x)),
        y: Math.max(0, Math.min(100, y))
    };
}
