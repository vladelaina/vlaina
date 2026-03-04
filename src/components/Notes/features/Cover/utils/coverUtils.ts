
export const MIN_HEIGHT = 120;
export const MAX_HEIGHT = 500;
export const DEFAULT_HEIGHT = 255;
export const DEFAULT_POSITION_PERCENT = 50;
export const DEFAULT_SCALE = 1;
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

const MAX_CACHE_SIZE = 50;
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

            if (dimensionCache.size >= MAX_CACHE_SIZE) {
                const firstKey = dimensionCache.keys().next().value;
                if (firstKey) dimensionCache.delete(firstKey);
            }
            dimensionCache.set(src, dims);

            resolve(dims);
        };
        img.onerror = () => resolve(null);
        img.src = src;
    });
}
interface Size { width: number; height: number; }
interface Point { x: number; y: number; }

export function getBaseDimensions(mediaSize: Size, containerSize: Size): Size {
    const mediaRatio = mediaSize.width / mediaSize.height;
    const containerRatio = containerSize.width / containerSize.height;

    let baseW: number, baseH: number;

    if (mediaRatio > containerRatio) {
        baseH = containerSize.height;
        baseW = baseH * mediaRatio;
    } else {
        baseW = containerSize.width;
        baseH = baseW / mediaRatio;
    }

    return { width: baseW, height: baseH };
}

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
    const x = ((DEFAULT_POSITION_PERCENT - positionPercent.x) / DEFAULT_POSITION_PERCENT) * maxTranslateX;
    const y = ((DEFAULT_POSITION_PERCENT - positionPercent.y) / DEFAULT_POSITION_PERCENT) * maxTranslateY;

    // Keep sub-pixel precision to avoid zoom/crop jitter on tiny adjustments.
    return {
        x: Math.abs(x) < 1e-6 ? 0 : x,
        y: Math.abs(y) < 1e-6 ? 0 : y
    };
}

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
    let percentX = DEFAULT_POSITION_PERCENT;
    let percentY = DEFAULT_POSITION_PERCENT;

    if (maxTranslateX > 0) {
        // x = ((50 - P) / 50) * Max
        // x / Max = (50 - P) / 50
        // (x / Max) * 50 = 50 - P
        // P = 50 - (x / Max) * 50
        percentX = DEFAULT_POSITION_PERCENT - (cropPixels.x / maxTranslateX) * DEFAULT_POSITION_PERCENT;
    }

    if (maxTranslateY > 0) {
        percentY = DEFAULT_POSITION_PERCENT - (cropPixels.y / maxTranslateY) * DEFAULT_POSITION_PERCENT;
    }

    // Clamp to 0-100 for safety
    return {
        x: Math.max(0, Math.min(100, percentX)),
        y: Math.max(0, Math.min(100, percentY))
    };
}
