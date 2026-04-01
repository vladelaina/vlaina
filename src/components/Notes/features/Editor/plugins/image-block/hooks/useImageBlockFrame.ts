import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const HOVER_HIDE_DELAY_MS = 300;

interface UseImageBlockFrameOptions {
    height: number | undefined;
    isEditingCaption: boolean;
    isActive: boolean;
    setIsHovered: (hovered: boolean) => void;
}

export function useImageBlockFrame({
    height,
    isEditingCaption,
    isActive,
    setIsHovered,
}: UseImageBlockFrameOptions) {
    const containerRef = useRef<HTMLDivElement>(null);
    const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const [dragDimensions, setDragDimensions] = useState<{ width: number; height: number } | null>(null);
    const [observedSize, setObservedSize] = useState({ width: 0, height: 0 });

    useEffect(() => {
        if (!containerRef.current) return;

        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width, height: nextHeight } = entry.contentRect;
                setObservedSize((prev) => {
                    if (Math.abs(prev.width - width) > 0.5 || Math.abs(prev.height - nextHeight) > 0.5) {
                        return { width, height: nextHeight };
                    }
                    return prev;
                });
            }
        });

        resizeObserver.observe(containerRef.current);
        return () => resizeObserver.disconnect();
    }, []);

    useEffect(() => {
        return () => {
            if (hoverTimeoutRef.current) {
                clearTimeout(hoverTimeoutRef.current);
            }
        };
    }, []);

    const handleMouseEnter = useCallback(() => {
        if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
            hoverTimeoutRef.current = undefined;
        }
        setIsHovered(true);
    }, [setIsHovered]);

    const handleMouseLeave = useCallback(() => {
        if (isEditingCaption || isActive) return;
        hoverTimeoutRef.current = setTimeout(() => setIsHovered(false), HOVER_HIDE_DELAY_MS);
    }, [isEditingCaption, isActive, setIsHovered]);

    const finalContainerSize = useMemo(() => {
        return dragDimensions || {
            width: observedSize.width || containerRef.current?.offsetWidth || 0,
            height: height || observedSize.height || containerRef.current?.offsetHeight || 0,
        };
    }, [dragDimensions, observedSize.width, observedSize.height, height]);

    return {
        containerRef,
        setDragDimensions,
        finalContainerSize,
        handleMouseEnter,
        handleMouseLeave,
    };
}
