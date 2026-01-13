
import { useState, useRef, useCallback, useEffect } from 'react';
import { useUIStore } from '@/stores/uiSlice';

const SIDEBAR_MIN_WIDTH = 200;
const SIDEBAR_MAX_WIDTH = 400;

export function useNotesSidebarResize() {
    const {
        notesSidebarWidth: sidebarWidth,
        setNotesSidebarWidth: setSidebarWidth
    } = useUIStore();

    const [isDragging, setIsDragging] = useState(false);
    const dragStartX = useRef(0);
    const dragStartWidth = useRef(0);
    const rafRef = useRef<number | null>(null);
    const pendingWidth = useRef<number | null>(null);

    const handleDragStart = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setIsDragging(true);
        dragStartX.current = e.clientX;
        dragStartWidth.current = sidebarWidth;

        // Prevent text selection during drag
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'col-resize';
    }, [sidebarWidth]);

    useEffect(() => {
        if (!isDragging) return;

        const handleMouseMove = (e: MouseEvent) => {
            const delta = e.clientX - dragStartX.current;
            const newWidth = Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, dragStartWidth.current + delta));

            // Store pending width and schedule update with rAF for smooth 60fps
            pendingWidth.current = newWidth;

            if (rafRef.current === null) {
                rafRef.current = requestAnimationFrame(() => {
                    if (pendingWidth.current !== null) {
                        setSidebarWidth(pendingWidth.current);
                        pendingWidth.current = null;
                    }
                    rafRef.current = null;
                });
            }
        };

        const handleMouseUp = () => {
            // Apply any pending width immediately
            if (pendingWidth.current !== null) {
                setSidebarWidth(pendingWidth.current);
                pendingWidth.current = null;
            }

            // Cancel any pending rAF
            if (rafRef.current !== null) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }

            // Restore normal styles
            document.body.style.userSelect = '';
            document.body.style.cursor = '';

            setIsDragging(false);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);

            // Cleanup on unmount
            if (rafRef.current !== null) {
                cancelAnimationFrame(rafRef.current);
            }
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
        };
    }, [isDragging, setSidebarWidth]);

    return { sidebarWidth, isDragging, handleDragStart };
}
