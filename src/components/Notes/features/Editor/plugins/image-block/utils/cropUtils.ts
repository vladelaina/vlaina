
import { CSSProperties } from 'react';

export interface CropParams {
    x: number;
    y: number;
    width: number;
    height: number;
    ratio: number;
}

/**
 * Parses the crop parameters from an image URL fragment
 * Format: #c=x,y,width,height,ratio
 */
export function parseCropFragment(src: string): { baseSrc: string; params: CropParams | null } {
    if (!src) return { baseSrc: '', params: null };

    const [baseSrc, fragment] = src.split('#');
    
    if (fragment && fragment.startsWith('c=')) {
        const parts = fragment.substring(2).split(',').map(Number);
        if (parts.length >= 4) {
            return {
                baseSrc,
                params: {
                    x: parts[0],
                    y: parts[1],
                    width: parts[2],
                    height: parts[3],
                    // 5th value is the original aspect ratio (default to 1 for backward compat)
                    ratio: parts.length >= 5 ? parts[4] : 1
                }
            };
        }
    }
    
    return { baseSrc, params: null };
}

/**
 * Generates the URL fragment for crop parameters
 */
export function generateCropFragment(
    percentageCrop: { x: number; y: number; width: number; height: number },
    ratio: number
): string {
    // Increase precision to 6 decimal places to prevent sub-pixel shifts
    return `c=${Number(percentageCrop.x.toFixed(6))},${Number(percentageCrop.y.toFixed(6))},${Number(percentageCrop.width.toFixed(6))},${Number(percentageCrop.height.toFixed(6))},${ratio.toFixed(6)}`;
}

/**
 * Generates the CSS styles for the View Mode (non-destructive crop)
 */
export function getCropViewStyles(params: CropParams): { container: CSSProperties; image: CSSProperties } {
    return {
        container: {
            aspectRatio: `${params.ratio}`,
            position: 'relative',
            overflow: 'hidden'
        },
        image: {
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: 'auto', // Allow height to be determined by aspect ratio
            display: 'block', // Removes inline-block gaps
            // transform order matters: translate first (move), then scale (zoom)
            // percentages in translate are relative to the element itself
            transform: `scale(${100 / params.width}) translate(-${params.x}%, -${params.y}%)`,
            transformOrigin: 'top left',
        }
    };
}

/**
 * Calculates the crop position in pixels (for react-easy-crop) from saved percentage params
 */
export function calculateRestoredCrop(
    params: CropParams,
    displayedWidthAtZoom1: number,
    displayedHeightAtZoom1: number
): { x: number; y: number } {
    // cropParams.x, y are percentages of the image that are offset
    // react-easy-crop's crop is in pixels from center
    
    const currentZoom = 100 / params.width;
    const scaledWidth = displayedWidthAtZoom1 * currentZoom;
    const scaledHeight = displayedHeightAtZoom1 * currentZoom;

    // Calculate the center offset in pixels
    // cropParams.x% of the image is hidden on the left
    // So the visible center is at (cropParams.x + cropParams.width/2)% of the image
    // Image center is at 50%
    // Offset = (50 - (cropParams.x + cropParams.width/2)) * scaledWidth / 100
    const visibleCenterX = params.x + params.width / 2;
    const visibleCenterY = params.y + params.height / 2;
    
    const cropX = (50 - visibleCenterX) * scaledWidth / 100;
    const cropY = (50 - visibleCenterY) * scaledHeight / 100;

    return { x: cropX, y: cropY };
}
