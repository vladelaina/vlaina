
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
 * Calculate the "Base" dimensions of the image as rendered with object-fit: cover/contain
 * This represents the image size when zoom = 1
 */
/**
 * Calculate the "Base" dimensions of the image as rendered with object-fit: cover/contain
 * This represents the image size when zoom = 1
 */
export function getBaseDimensions(mediaSize: Size, containerSize: Size): Size {
    const mediaRatio = mediaSize.width / mediaSize.height;
    const containerRatio = containerSize.width / containerSize.height;

    let baseW: number, baseH: number;

    // "cover" logic: defaults to matching the SMALLER dimension to fill gaps
    // If image is wider than container (relative to height), we match height
    // If image is taller than container (relative to width), we match width
    // Wait, object-fit: cover works by matching the constrained dimension

    // Logic from react-easy-crop or standard CSS 'cover':
    if (mediaRatio > containerRatio) {
        // Image is wider than container: Match Height, crop Width
        baseH = containerSize.height;
        baseW = baseH * mediaRatio;
    } else {
        // Image is taller than container: Match Width, crop Height
        baseW = containerSize.width;
        baseH = baseW / mediaRatio;
    }

    return { width: baseW, height: baseH };
}

/**
 * Convert Database Percentage Position (0-100) to React-Easy-Crop Pixel Offset
 */
export function calculateCropPixels(
    positionPercent: Point,
    mediaSize: Size,
    containerSize: Size,
    zoom: number
): Point {
    // 1. Get the actual rendered size of the image at zoom=1 (Cover state)
    const baseDims = getBaseDimensions(mediaSize, containerSize);

    // 2. Apply Zoom to get the final visual size
    const scaledW = baseDims.width * zoom;
    const scaledH = baseDims.height * zoom;

    // Max translation allowed (dragging to edge)
    const maxTranslateX = (scaledW - containerSize.width) / 2;
    const maxTranslateY = (scaledH - containerSize.height) / 2;

    // Map 0-100% to +Max -> -Max translation
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
    // 1. Get the actual rendered size
    const baseDims = getBaseDimensions(mediaSize, containerSize);

    const scaledW = baseDims.width * zoom;
    const scaledH = baseDims.height * zoom;

    const maxTranslateX = (scaledW - containerSize.width) / 2;
    const maxTranslateY = (scaledH - containerSize.height) / 2;

    // Prevent divide by zero if perfect fit
    let percentX = 50;
    let percentY = 50;

    if (maxTranslateX > 0) {
        // x = ((50 - P) / 50) * Max
        // x / Max = (50 - P) / 50
        // (x / Max) * 50 = 50 - P
        // P = 50 - (x / Max) * 50
        percentX = 50 - (cropPixels.x / maxTranslateX) * 50;
    }

    if (maxTranslateY > 0) {
        percentY = 50 - (cropPixels.y / maxTranslateY) * 50;
    }

    // Clamp to 0-100 for safety
    return {
        x: Math.max(0, Math.min(100, percentX)),
        y: Math.max(0, Math.min(100, percentY))
    };
}

