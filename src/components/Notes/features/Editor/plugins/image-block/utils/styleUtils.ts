import React from 'react';
import {
    themeImageBlockStyleTokens,
    themeMotionTokens,
    themeStyleResetTokens,
} from '@/styles/themeTokens';
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
        zIndex: 'var(--vlaina-z-max)',
        pointerEvents: themeStyleResetTokens.pointerEventsNone,
        opacity: 'var(--vlaina-opacity-90)',
        transform: 'scale(var(--vlaina-scale-95))',
        boxShadow: 'var(--vlaina-shadow-drag-preview)',
        transition: themeStyleResetTokens.transitionNone,
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
        maxWidth: themeImageBlockStyleTokens.maxWidthFull,
        height: hasActiveSize ? `${activeSize!.height}px` : height ? height : themeImageBlockStyleTokens.heightAuto,
        minHeight: isReady || height ? undefined : 'var(--vlaina-size-100px)',
        aspectRatio: hasActiveSize ? themeImageBlockStyleTokens.aspectRatioAuto : computedAspectRatio,
        transition: (isActive || height) ? themeStyleResetTokens.transitionNone : themeImageBlockStyleTokens.normalTransition,
        display: themeImageBlockStyleTokens.displayBlock,
        opacity: themeMotionTokens.opacityVisible,
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
