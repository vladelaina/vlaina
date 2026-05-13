import { RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';

const HOVER_HIDE_DELAY_MS = 300;

function isUsableSize(size: { width: number; height: number }) {
    return Number.isFinite(size.width)
        && Number.isFinite(size.height)
        && size.width > 0.5
        && size.height > 0.5;
}

interface UseImageBlockFrameOptions {
    height: number | undefined;
    isEditingCaption: boolean;
    isActive: boolean;
    isHoverDisabled: boolean;
    setIsHovered: (hovered: boolean) => void;
    containerRef?: RefObject<HTMLDivElement | null>;
}

export function useImageBlockFrame({
    height,
    isEditingCaption,
    isActive,
    isHoverDisabled,
    setIsHovered,
    containerRef: providedContainerRef,
}: UseImageBlockFrameOptions) {
    const fallbackContainerRef = useRef<HTMLDivElement>(null);
    const containerRef = providedContainerRef ?? fallbackContainerRef;
    const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const lastUsableSizeRef = useRef({ width: 0, height: 0 });
    const [dragDimensions, setDragDimensions] = useState<{ width: number; height: number } | null>(null);
    const [observedSize, setObservedSize] = useState({ width: 0, height: 0 });

    useEffect(() => {
        if (!containerRef.current) return;

        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width, height: nextHeight } = entry.contentRect;
                const nextSize = { width, height: nextHeight };

                if (isUsableSize(nextSize)) {
                    lastUsableSizeRef.current = nextSize;
                } else if (isActive && isUsableSize(lastUsableSizeRef.current)) {
                    return;
                }

                setObservedSize((prev) => {
                    if (Math.abs(prev.width - width) > 0.5 || Math.abs(prev.height - nextHeight) > 0.5) {
                        return nextSize;
                    }
                    return prev;
                });
            }
        });

        resizeObserver.observe(containerRef.current);
        return () => resizeObserver.disconnect();
    }, [isActive]);

    useEffect(() => {
        return () => {
            if (hoverTimeoutRef.current) {
                clearTimeout(hoverTimeoutRef.current);
                hoverTimeoutRef.current = undefined;
            }
        };
    }, []);

    const handleMouseEnter = useCallback(() => {
        if (isHoverDisabled) {
            setIsHovered(false);
            return;
        }

        if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
            hoverTimeoutRef.current = undefined;
        }
        setIsHovered(true);
    }, [isHoverDisabled, setIsHovered]);

    const handleMouseLeave = useCallback(() => {
        if (isHoverDisabled) {
            setIsHovered(false);
            return;
        }

        if (isEditingCaption || isActive) return;
        if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
        }
        hoverTimeoutRef.current = setTimeout(() => setIsHovered(false), HOVER_HIDE_DELAY_MS);
    }, [isHoverDisabled, isEditingCaption, isActive, setIsHovered]);

    const finalContainerSize = useMemo(() => {
        if (dragDimensions) return dragDimensions;

        const currentSize = {
            width: observedSize.width || containerRef.current?.offsetWidth || 0,
            height: height || observedSize.height || containerRef.current?.offsetHeight || 0,
        };

        if (isUsableSize(currentSize)) {
            lastUsableSizeRef.current = currentSize;
            return currentSize;
        }

        if (isActive && isUsableSize(lastUsableSizeRef.current)) {
            return lastUsableSizeRef.current;
        }

        return currentSize;
    }, [dragDimensions, observedSize.width, observedSize.height, height, isActive]);

    return {
        containerRef,
        setDragDimensions,
        finalContainerSize,
        handleMouseEnter,
        handleMouseLeave,
    };
}
