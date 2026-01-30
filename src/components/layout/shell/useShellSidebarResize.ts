import { useState, useRef, useCallback, useEffect } from 'react';

const SIDEBAR_MIN_WIDTH = 200;
const SIDEBAR_MAX_WIDTH = 400;
const SIDEBAR_DEFAULT_WIDTH = 255; 
const SNAP_THRESHOLD = 20; 
const SNAP_RESISTANCE = 0.3; 

interface UseShellSidebarResizeProps {
    width: number;
    onWidthChange: (width: number) => void;
}

export function useShellSidebarResize({ width, onWidthChange }: UseShellSidebarResizeProps) {
    const [isDragging, setIsDragging] = useState(false);
    const dragStartX = useRef(0);
    const dragStartWidth = useRef(0);
    const rafRef = useRef<number | null>(null);
    const pendingWidth = useRef<number | null>(null);
    const lastClickTime = useRef(0);
    const sidebarRef = useRef<HTMLElement | null>(null);

    // Double-click to reset to default width
    const handleDoubleClick = useCallback(() => {
        onWidthChange(SIDEBAR_DEFAULT_WIDTH);
    }, [onWidthChange]);

    const handleDragStart = useCallback((e: React.MouseEvent) => {
        const now = Date.now();

        if (now - lastClickTime.current < 300) {
            handleDoubleClick();
            lastClickTime.current = 0;
            return;
        }
        lastClickTime.current = now;

        e.preventDefault();
        setIsDragging(true);
        dragStartX.current = e.clientX;
        dragStartWidth.current = width;

        sidebarRef.current = document.querySelector('aside') as HTMLElement;
        if (sidebarRef.current) {
            sidebarRef.current.style.willChange = 'width';
        }

        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'col-resize';
    }, [width, handleDoubleClick]);

    useEffect(() => {
        if (!isDragging) return;

        const handleMouseMove = (e: MouseEvent) => {
            const delta = e.clientX - dragStartX.current;
            let newWidth = dragStartWidth.current + delta;

            if (newWidth < SIDEBAR_MIN_WIDTH + SNAP_THRESHOLD) {
                const overMin = SIDEBAR_MIN_WIDTH - newWidth;
                if (overMin > 0) {
                    newWidth = SIDEBAR_MIN_WIDTH - (overMin * SNAP_RESISTANCE);
                }
            } else if (newWidth > SIDEBAR_MAX_WIDTH - SNAP_THRESHOLD) {
                const overMax = newWidth - SIDEBAR_MAX_WIDTH;
                if (overMax > 0) {
                    newWidth = SIDEBAR_MAX_WIDTH + (overMax * SNAP_RESISTANCE);
                }
            }

            newWidth = Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, newWidth));

            pendingWidth.current = newWidth;

            if (rafRef.current === null) {
                rafRef.current = requestAnimationFrame(() => {
                    if (pendingWidth.current !== null) {
                        onWidthChange(pendingWidth.current);
                        pendingWidth.current = null;
                    }
                    rafRef.current = null;
                });
            }
        };

        const handleMouseUp = () => {
            if (pendingWidth.current !== null) {
                onWidthChange(pendingWidth.current);
                pendingWidth.current = null;
            }

            if (rafRef.current !== null) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }

            if (sidebarRef.current) {
                sidebarRef.current.style.willChange = '';
                sidebarRef.current = null;
            }

            document.body.style.userSelect = '';
            document.body.style.cursor = '';

            setIsDragging(false);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);

            if (rafRef.current !== null) {
                cancelAnimationFrame(rafRef.current);
            }
            if (sidebarRef.current) {
                sidebarRef.current.style.willChange = '';
            }
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
        };
    }, [isDragging, onWidthChange]);

    return { isDragging, handleDragStart };
}