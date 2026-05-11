import { useEffect, useState } from 'react';
import { Icon } from '@/components/ui/icons';
import { useI18n } from '@/lib/i18n';
import { isPublicRemoteMediaUrl } from '@/lib/notes/markdown/urlSecurity';
import { ImageCropper } from './ImageCropper';
import { getCropViewStyles } from '../utils/cropGeometry';
import type { CropParams } from '../utils/imageSourceFragment';
import type { CropArea, LoadedMediaSize, CropperViewportState, ResizeDirection } from '../types';

interface ImageContentProps {
    isLoading: boolean;
    loadError: boolean;
    resolvedSrc?: string;
    isReady: boolean;
    cropParams: CropParams | null;
    containerSize: { width: number; height: number };
    isSaving: boolean;
    isActive: boolean;
    onSave: (percentageCrop: CropArea, ratio: number) => void;
    onCancel: () => void;
    onResizeStart: (direction: ResizeDirection) => (e: React.MouseEvent) => void;
    onMediaLoaded: (media: LoadedMediaSize) => void;
    onStateChange?: (state: CropperViewportState) => void;
}

export const ImageContent = ({
    isLoading,
    loadError,
    resolvedSrc,
    isReady,
    cropParams,
    containerSize,
    isSaving,
    isActive,
    onSave,
    onCancel,
    onResizeStart,
    onMediaLoaded,
    onStateChange
}: ImageContentProps) => {
    const { t } = useI18n();
    const [mediaError, setMediaError] = useState(false);

    useEffect(() => {
        setMediaError(false);
    }, [resolvedSrc]);

    const isRemoteImage = isPublicRemoteMediaUrl(resolvedSrc);
    const shouldRenderPlainRemoteImage = isRemoteImage && !isActive && !cropParams;
    const shouldRenderCropPreview = !isActive && !!cropParams;
    const cropPreviewStyles = cropParams ? getCropViewStyles(cropParams) : null;

    if ((isLoading || !resolvedSrc) && !isReady) {
        return (
            <div className="w-full h-full min-h-[100px] flex flex-col items-center justify-center bg-gray-50 dark:bg-zinc-900 rounded-md">
                <div className="size-6 border-2 border-gray-300 dark:border-zinc-600 border-t-[var(--vlaina-accent)] rounded-full animate-spin" />
            </div>
        );
    }

    if (loadError || mediaError) {
        return (
            <div className="w-full h-full min-h-[100px] flex flex-col items-center justify-center bg-gray-50 dark:bg-zinc-900 border border-dashed border-gray-200 dark:border-zinc-700 rounded-md text-gray-400 dark:text-zinc-500">
                <Icon name="file.brokenImage" className="size-8 mb-2 opacity-50" />
                <span className="text-xs font-medium">{t('editor.imageNotFound')}</span>
            </div>
        );
    }

    if (shouldRenderPlainRemoteImage) {
        return (
            <img
                src={resolvedSrc}
                alt=""
                draggable={false}
                className="block h-auto max-w-full select-none object-contain"
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
                }}
            />
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
