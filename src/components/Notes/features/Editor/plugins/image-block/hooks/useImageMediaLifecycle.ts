import { useCallback } from 'react';
import type { LoadedMediaSize, ImageNodeAttrs } from '../types';
import { resolveInitialImageWidth } from '../utils/imageInitialWidth';

interface UseImageMediaLifecycleOptions {
    width: string;
    nodeSrc: string;
    nodeAlt: string;
    containerRef: React.RefObject<HTMLDivElement | null>;
    setWidth: (width: string) => void;
    setCaptionInput: (caption: string) => void;
    setNaturalRatio: (ratio: number) => void;
    setIsReady: (isReady: boolean) => void;
    updateNodeAttrs: (attrs: ImageNodeAttrs) => void;
}

const MAX_CAPTION_SOURCE_CHARS = 4096;
const MAX_CAPTION_FILENAME_SEGMENT_DECODE_CHARS = 2048;
const MAX_CAPTION_CHARS = 512;

function normalizeFilenameCaption(value: string): string | null {
    const normalized = value.trim();
    return normalized && normalized.length <= MAX_CAPTION_CHARS ? normalized : null;
}

function extractFilenameCaption(src: string): string | null {
    if (!src) return null;
    if (src.length > MAX_CAPTION_SOURCE_CHARS) return null;

    const normalizedSrc = src.replace(/\\/g, '/');
    const filename = normalizedSrc.substring(normalizedSrc.lastIndexOf('/') + 1);
    if (!filename) return null;

    const nameWithoutExt = filename.replace(/\.[^/.]+$/, '').trim();
    if (!nameWithoutExt) return null;
    if (nameWithoutExt.length > MAX_CAPTION_FILENAME_SEGMENT_DECODE_CHARS) return null;

    try {
        return normalizeFilenameCaption(decodeURIComponent(nameWithoutExt));
    } catch {
        return normalizeFilenameCaption(nameWithoutExt);
    }
}

export function useImageMediaLifecycle({
    width,
    nodeSrc,
    nodeAlt,
    containerRef,
    setWidth,
    setCaptionInput,
    setNaturalRatio,
    setIsReady,
    updateNodeAttrs,
}: UseImageMediaLifecycleOptions) {
    const onMediaLoaded = useCallback((media: LoadedMediaSize) => {
        const containerWidth = containerRef.current?.parentElement?.offsetWidth ?? null;
        const nextWidth = width === 'auto' && containerWidth
            ? resolveInitialImageWidth(media.naturalWidth, containerWidth)
            : null;

        if (media.naturalHeight > 0) {
            setNaturalRatio(media.naturalWidth / media.naturalHeight);
        }

        if (width === 'auto') {
            if (containerWidth) {
                if (nextWidth) {
                    setWidth(nextWidth);
                    updateNodeAttrs({ width: nextWidth });
                }
            }
        }

        if (!nodeAlt) {
            const generatedCaption = extractFilenameCaption(nodeSrc);
            if (generatedCaption) {
                setCaptionInput(generatedCaption);
                updateNodeAttrs({ alt: generatedCaption });
            }
        }

        setIsReady(true);
    }, [
        width,
        nodeSrc,
        nodeAlt,
        containerRef,
        setNaturalRatio,
        setWidth,
        setCaptionInput,
        setIsReady,
        updateNodeAttrs,
    ]);

    return { onMediaLoaded };
}
