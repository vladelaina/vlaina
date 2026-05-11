import React from 'react';
import type { Alignment } from '../types';

export const ALIGNMENT_CLASSES: Record<Alignment, string> = {
    left: 'mr-auto',
    center: 'mx-auto',
    right: 'ml-auto',
};

interface DraggingStyleParams {
    dragPosition: { x: number; y: number };
    dragSize: { width: number; height: number };
}

interface NormalStyleParams {
    width: string;
    height: number | undefined;
    isActive: boolean;
    isReady: boolean;
    computedAspectRatio: string;
    activeSize?: { width: number; height: number } | null;
}

export function getDraggingStyle({ dragPosition, dragSize }: DraggingStyleParams): React.CSSProperties {
    return {
        position: 'fixed',
        left: dragPosition.x,
        top: dragPosition.y,
        width: dragSize.width,
        height: dragSize.height,
        zIndex: 9999,
        pointerEvents: 'none',
        opacity: 0.9,
        transform: 'scale(0.95)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        transition: 'none',
    };
}

export function getNormalStyle({ width, height, isActive, isReady, computedAspectRatio, activeSize }: NormalStyleParams): React.CSSProperties {
    const hasActiveSize = Boolean(
        isActive
        && activeSize
        && Number.isFinite(activeSize.width)
        && Number.isFinite(activeSize.height)
        && activeSize.width > 0
        && activeSize.height > 0
    );

    return {
        width: hasActiveSize ? `${activeSize!.width}px` : width,
        maxWidth: '100%',
        height: hasActiveSize ? `${activeSize!.height}px` : height ? height : 'auto',
        minHeight: isReady || height ? undefined : 100,
        aspectRatio: hasActiveSize ? 'auto' : computedAspectRatio,
        transition: (isActive || height) ? 'none' : 'width 0.1s ease-out, opacity 0.2s ease-out',
        display: 'block',
        opacity: 1,
    };
}

export function getContainerStyle(
    isDragging: boolean,
    dragPosition: { x: number; y: number } | null,
    dragSize: { width: number; height: number } | null,
    normalParams: NormalStyleParams
): React.CSSProperties {
    if (isDragging && dragPosition && dragSize) {
        return getDraggingStyle({ dragPosition, dragSize });
    }
    return getNormalStyle(normalParams);
}

export function computeAspectRatio(
    height: number | undefined,
    cropParams: { ratio: number } | null,
    naturalRatio: number | null
): string {
    if (height) return 'auto';
    if (cropParams) return `${cropParams.ratio}`;
    if (naturalRatio) return `${naturalRatio}`;
    return 'auto';
}
