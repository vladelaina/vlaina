import { CSSProperties } from 'react';

export interface CropParams {
    x: number;
    y: number;
    width: number;
    height: number;
    ratio: number;
}

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
                    ratio: parts.length >= 5 ? parts[4] : 1
                }
            };
        }
    }

    return { baseSrc, params: null };
}

export function generateCropFragment(
    percentageCrop: { x: number; y: number; width: number; height: number },
    ratio: number
): string {
    const { x, y, width, height } = percentageCrop;
    return `c=${x.toFixed(6)},${y.toFixed(6)},${width.toFixed(6)},${height.toFixed(6)},${ratio.toFixed(6)}`;
}

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
            height: 'auto',
            display: 'block',
            transform: `scale(${100 / params.width}) translate(-${params.x}%, -${params.y}%)`,
            transformOrigin: 'top left',
        }
    };
}

export function calculateRestoredCrop(
    params: CropParams,
    displayedWidthAtZoom1: number,
    displayedHeightAtZoom1: number
): { x: number; y: number } {
    const currentZoom = 100 / params.width;
    const scaledWidth = displayedWidthAtZoom1 * currentZoom;
    const scaledHeight = displayedHeightAtZoom1 * currentZoom;

    const visibleCenterX = params.x + params.width / 2;
    const visibleCenterY = params.y + params.height / 2;

    const cropX = (50 - visibleCenterX) * scaledWidth / 100;
    const cropY = (50 - visibleCenterY) * scaledHeight / 100;

    return { x: cropX, y: cropY };
}
