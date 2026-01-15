
export const MIN_HEIGHT = 120;
export const MAX_HEIGHT = 500;
export const DEFAULT_HEIGHT = 255;
export const MIN_SCALE = 1;
export const MAX_SCALE = 3;
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

// Load image and get its natural dimensions
export async function loadImageWithDimensions(src: string): Promise<{ width: number; height: number } | null> {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = () => resolve(null);
        img.src = src;
    });
}
