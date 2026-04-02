import type { CSSProperties } from 'react';
import type { CropParams } from './imageSourceFragment';

export function getCropViewStyles(params: CropParams): { container: CSSProperties; image: CSSProperties } {
    return {
        container: {
            aspectRatio: `${params.ratio}`,
            position: 'relative',
            overflow: 'hidden',
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
        },
    };
}

export function calculateRestoredCrop(
    params: CropParams,
    displayedWidthAtZoom1: number,
    displayedHeightAtZoom1: number,
): { x: number; y: number } {
    const currentZoom = 100 / params.width;
    const scaledWidth = displayedWidthAtZoom1 * currentZoom;
    const scaledHeight = displayedHeightAtZoom1 * currentZoom;

    const visibleCenterX = params.x + params.width / 2;
    const visibleCenterY = params.y + params.height / 2;

    return {
        x: (50 - visibleCenterX) * scaledWidth / 100,
        y: (50 - visibleCenterY) * scaledHeight / 100,
    };
}
