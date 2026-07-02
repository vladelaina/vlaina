import { lazy, Suspense } from 'react';
import { themeRadiusTokens, themeStyleResetTokens } from '@/styles/themeTokens';
import type { CropperViewportState } from '../types';
import type { CropParams } from '../utils/imageSourceFragment';

const LazyImageCropper = lazy(async () => {
    const mod = await import('./ImageCropper');
    return { default: mod.ImageCropper };
});

interface ImageDragOverlayProps {
    isDragging: boolean;
    dragPosition: { x: number; y: number } | null;
    dragSize: { width: number; height: number } | null;
    resolvedSrc: string;
    cropParams: CropParams | null;
    overrideState: CropperViewportState | null;
}

export function ImageDragOverlay({
    isDragging,
    dragPosition,
    dragSize,
    resolvedSrc,
    cropParams,
    overrideState,
}: ImageDragOverlayProps) {
    if (!isDragging || !dragPosition || !dragSize) {
        return null;
    }

    return (
        <div
            style={{
                position: 'fixed',
                top: dragPosition.y,
                left: dragPosition.x,
                width: dragSize.width,
                height: dragSize.height,
                zIndex: 'var(--vlaina-z-max)',
                pointerEvents: themeStyleResetTokens.pointerEventsNone,
                boxShadow: 'var(--vlaina-shadow-drag-preview)',
                borderRadius: themeRadiusTokens.px8Var,
                overflow: 'hidden',
                backgroundColor: 'var(--vlaina-bg-primary)',
            }}
        >
            <Suspense
                fallback={(
                    <img
                        src={resolvedSrc}
                        alt=""
                        draggable={false}
                        className="block h-full w-full select-none object-contain"
                        referrerPolicy="no-referrer"
                    />
                )}
            >
                <LazyImageCropper
                    imageSrc={resolvedSrc}
                    initialCropParams={cropParams}
                    overrideState={overrideState}
                    containerSize={dragSize}
                    onSave={() => {}}
                    onCancel={() => {}}
                    isSaving={false}
                    isActive={false}
                />
            </Suspense>
        </div>
    );
}
