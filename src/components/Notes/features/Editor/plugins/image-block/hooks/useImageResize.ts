import { useCallback, useRef, useEffect } from 'react';

interface UseImageResizeOptions {
    containerRef: React.RefObject<HTMLDivElement | null>;
    width: string;
    height: number | undefined;
    setWidth: (width: string) => void;
    setHeight: (height: number | undefined) => void;
    setDragDimensions: (dims: { width: number; height: number } | null) => void;
    updateNodeAttrs: (attrs: Record<string, any>) => void;
    restoreIfNeeded: () => Promise<void>;
}

type ResizeDirection = 'left' | 'right' | 'top' | 'bottom' | 'bottom-left' | 'bottom-right';

export function useImageResize({
    containerRef,
    width,
    height,
    setWidth,
    setHeight,
    setDragDimensions,
    updateNodeAttrs,
    restoreIfNeeded,
}: UseImageResizeOptions) {
    const cleanupRef = useRef<(() => void) | null>(null);

    useEffect(() => {
        return () => {
            if (cleanupRef.current) {
                cleanupRef.current();
            }
        };
    }, []);

    const handleResizeStart = useCallback((direction: ResizeDirection) => (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const isProportional = direction === 'left' || direction === 'right' || direction === 'bottom-left' || direction === 'bottom-right';

        if (!isProportional && !height && containerRef.current) {
            setHeight(containerRef.current.offsetHeight);
        }

        const startX = e.clientX;
        const startY = e.clientY;
        const startWidth = containerRef.current?.offsetWidth || 0;
        const startHeight = height || containerRef.current?.offsetHeight || 0;
        const parentWidth = containerRef.current?.parentElement?.offsetWidth || 1;
        const aspectRatio = startHeight > 0 ? startWidth / startHeight : 1;

        const onMouseMove = (moveEvent: MouseEvent) => {
            if (isProportional) {
                const isLeftSided = direction === 'left' || direction === 'bottom-left';
                const delta = isLeftSided ? startX - moveEvent.clientX : moveEvent.clientX - startX;

                const newWidthPx = startWidth + delta * 2;
                const newWidthPercent = Math.min(100, Math.max(10, (newWidthPx / parentWidth) * 100));

                setWidth(`${newWidthPercent}%`);
                const expectedHeight = newWidthPx / aspectRatio;
                setDragDimensions({ width: newWidthPx, height: expectedHeight });
            } else {
                const delta = moveEvent.clientY - startY;
                const newHeight = Math.max(50, startHeight + delta);
                setHeight(newHeight);
                setDragDimensions({ width: startWidth, height: newHeight });
            }
        };

        const onMouseUp = async () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            cleanupRef.current = null;

            setDragDimensions(null);
            await restoreIfNeeded();

            if (isProportional) {
                updateNodeAttrs({ width });
                setHeight(undefined);
            }
        };

        cleanupRef.current = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }, [containerRef, width, height, setWidth, setHeight, setDragDimensions, updateNodeAttrs, restoreIfNeeded]);

    return { handleResizeStart };
}
