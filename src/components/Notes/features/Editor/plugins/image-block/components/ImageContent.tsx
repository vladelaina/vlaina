import { Icon } from '@/components/ui/icons';
import { ImageCropper } from './ImageCropper';
import { CropParams } from '../utils/cropUtils';
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

    if ((isLoading || !resolvedSrc) && !isReady) {
        return (
            <div className="w-full h-full min-h-[100px] flex flex-col items-center justify-center bg-gray-50 dark:bg-zinc-900 rounded-md">
                <div className="size-6 border-2 border-gray-300 dark:border-zinc-600 border-t-[var(--neko-accent)] rounded-full animate-spin" />
            </div>
        );
    }

    if (loadError) {
        return (
            <div className="w-full h-full min-h-[100px] flex flex-col items-center justify-center bg-gray-50 dark:bg-zinc-900 border border-dashed border-gray-200 dark:border-zinc-700 rounded-md text-gray-400 dark:text-zinc-500">
                <Icon name="file.brokenImage" className="size-8 mb-2 opacity-50" />
                <span className="text-xs font-medium">Image not found</span>
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
