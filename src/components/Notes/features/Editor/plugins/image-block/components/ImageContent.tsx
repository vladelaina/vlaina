import { useEffect, useState } from 'react';
import { Icon } from '@/components/ui/icons';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { ImageCropper } from './ImageCropper';
import { getCropViewStyles } from '../utils/cropGeometry';
import type { CropParams } from '../utils/imageSourceFragment';
import type { CropArea, LoadedMediaSize, CropperViewportState, ResizeDirection } from '../types';

interface ImageContentProps {
    isLoading: boolean;
    loadError: boolean;
    resolvedSrc?: string;
    isRemoteImageSource: boolean;
    isDeferred: boolean;
    isReady: boolean;
    cropParams: CropParams | null;
    containerSize: { width: number; height: number };
    isSaving: boolean;
    isActive: boolean;
    onSave: (percentageCrop: CropArea, ratio: number) => void;
    onCancel: () => void;
    onResizeStart: (direction: ResizeDirection) => (e: React.MouseEvent) => void;
    onMediaLoaded: (media: LoadedMediaSize) => void;
    onMediaErrorChange?: (hasError: boolean) => void;
    onStateChange?: (state: CropperViewportState) => void;
}

export const ImageContent = ({
    isLoading,
    loadError,
    resolvedSrc,
    isRemoteImageSource,
    isDeferred,
    isReady,
    cropParams,
    containerSize,
    isSaving,
    isActive,
    onSave,
    onCancel,
    onResizeStart,
    onMediaLoaded,
    onMediaErrorChange,
    onStateChange
}: ImageContentProps) => {
    const { t } = useI18n();
    const [mediaError, setMediaError] = useState(false);
    const [isImageLoaded, setIsImageLoaded] = useState(false);

    useEffect(() => {
        setMediaError(false);
        setIsImageLoaded(false);
        onMediaErrorChange?.(false);
    }, [onMediaErrorChange, resolvedSrc]);

    const shouldRenderPlainRemoteImage = isRemoteImageSource && !isActive && !cropParams;
    const shouldRenderCropPreview = !isActive && !!cropParams;
    const cropPreviewStyles = cropParams ? getCropViewStyles(cropParams) : null;

    if (isDeferred && !isReady) {
        return (
            <div
                data-testid="deferred-image-placeholder"
                className="w-full h-full min-h-[100px] flex items-center justify-center bg-gray-50 dark:bg-zinc-900 border border-dashed border-gray-200 dark:border-zinc-700 rounded-md"
            >
                <Icon name="file.image" className="size-6 text-gray-300 dark:text-zinc-600" />
            </div>
        );
    }

    if ((isLoading || !resolvedSrc) && !isReady) {
        return (
            <div className="w-full h-full min-h-[100px] flex flex-col items-center justify-center bg-gray-50 dark:bg-zinc-900 rounded-md">
                <div className="size-6 border-2 border-gray-300 dark:border-zinc-600 border-t-[var(--vlaina-accent)] rounded-full animate-spin" />
            </div>
        );
    }

    if (loadError || mediaError) {
        return (
            <div className="w-full h-full min-h-[100px] flex flex-col items-center justify-center border border-dashed border-gray-200 dark:border-zinc-700 rounded-md text-gray-400 dark:text-zinc-500">
                <Icon name="file.brokenImage" className="size-8 mb-2 opacity-50" />
                <span className="text-xs font-medium">{t('editor.imageNotFound')}</span>
            </div>
        );
    }

    if (shouldRenderPlainRemoteImage) {
        return (
            <div
                className={cn(
                    'relative w-full overflow-hidden rounded-md bg-gray-50 dark:bg-zinc-900',
                    !isImageLoaded && 'min-h-[100px]'
                )}
            >
                {!isImageLoaded ? (
                    <div
                        data-testid="remote-image-placeholder"
                        aria-hidden="true"
                        className="absolute inset-0 flex items-center justify-center border border-dashed border-gray-200 dark:border-zinc-700"
                    >
                        <div className="size-6 rounded-full border-2 border-gray-300 border-t-[var(--vlaina-accent)] dark:border-zinc-600" />
                    </div>
                ) : null}
                <img
                    src={resolvedSrc}
                    alt=""
                    draggable={false}
                    className={cn(
                        'block h-auto max-w-full select-none object-contain transition-opacity duration-150',
                        isImageLoaded ? 'opacity-100' : 'opacity-0'
                    )}
                    onLoad={(event) => {
                        const image = event.currentTarget;
                        setIsImageLoaded(true);
                        onMediaLoaded({
                            width: image.width,
                            height: image.height,
                            naturalWidth: image.naturalWidth,
                            naturalHeight: image.naturalHeight,
                        });
                    }}
                    onError={() => {
                        setMediaError(true);
                        onMediaErrorChange?.(true);
                    }}
                />
            </div>
        );
    }

    if (shouldRenderCropPreview && cropPreviewStyles) {
        return (
            <div
                className="relative h-full w-full overflow-hidden"
                style={cropPreviewStyles.container}
            >
                <img
                    src={resolvedSrc}
                    alt=""
                    draggable={false}
                    className="select-none"
                    style={cropPreviewStyles.image}
                    onLoad={(event) => {
                        const image = event.currentTarget;
                        onMediaLoaded({
                            width: image.width,
                            height: image.height,
                            naturalWidth: image.naturalWidth,
                            naturalHeight: image.naturalHeight,
                        });
                    }}
                    onError={() => {
                        setMediaError(true);
                        onMediaErrorChange?.(true);
                    }}
                />
            </div>
        );
    }

    return (
        <ImageCropper
            imageSrc={resolvedSrc!}
            initialCropParams={cropParams}
            containerSize={containerSize}
            onSave={onSave}
            onCancel={onCancel}
            isSaving={isSaving}
            isActive={isActive}
            onResizeStart={onResizeStart}
            onMediaLoaded={onMediaLoaded}
            onStateChange={onStateChange}
        />
    );
};
