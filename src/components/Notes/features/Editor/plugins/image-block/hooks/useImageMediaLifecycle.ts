import { useCallback } from 'react';
import { parseImageSource } from '../utils/imageSourceFragment';
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

function extractFilenameCaption(src: string): string | null {
    const baseSrc = parseImageSource(src).baseSrc;
    if (!baseSrc) return null;

    const normalizedSrc = baseSrc.replace(/\\/g, '/');
    const filename = normalizedSrc.substring(normalizedSrc.lastIndexOf('/') + 1);
    if (!filename) return null;

    const nameWithoutExt = filename.replace(/\.[^/.]+$/, '').trim();
    if (!nameWithoutExt) return null;

    try {
        return decodeURIComponent(nameWithoutExt);
    } catch {
        return nameWithoutExt;
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
