
import { useState, useRef, useCallback, useEffect } from 'react';
import { useUIStore } from '@/stores/uiSlice';

const SIDEBAR_MIN_WIDTH = 200;
const SIDEBAR_MAX_WIDTH = 400;
const SIDEBAR_DEFAULT_WIDTH = 255; // 1080p / 1.618 / 1.618 / 1.618 ~= 255px (Golden Ratio recursion)
const SNAP_THRESHOLD = 20; // Pixels from edge to trigger snapping
const SNAP_RESISTANCE = 0.3; // Resistance factor when near edge

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
    const lastClickTime = useRef(0);
    const sidebarRef = useRef<HTMLElement | null>(null);

    // Double-click to reset to default width
    const handleDoubleClick = useCallback(() => {
        setSidebarWidth(SIDEBAR_DEFAULT_WIDTH);
    }, [setSidebarWidth]);

    const handleDragStart = useCallback((e: React.MouseEvent) => {
        const now = Date.now();

        // Double-click detection (within 300ms)
        if (now - lastClickTime.current < 300) {
            handleDoubleClick();
            lastClickTime.current = 0;
            return;
        }
        lastClickTime.current = now;

        e.preventDefault();
        setIsDragging(true);
        dragStartX.current = e.clientX;
        dragStartWidth.current = sidebarWidth;

        // Find sidebar element and add will-change hint for better performance
        sidebarRef.current = document.querySelector('aside') as HTMLElement;
        if (sidebarRef.current) {
            sidebarRef.current.style.willChange = 'width';
        }

        // Prevent text selection during drag
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'col-resize';
    }, [sidebarWidth, handleDoubleClick]);

    useEffect(() => {
        if (!isDragging) return;

        const handleMouseMove = (e: MouseEvent) => {
            const delta = e.clientX - dragStartX.current;
            let newWidth = dragStartWidth.current + delta;

            // Apply edge snapping with resistance
            if (newWidth < SIDEBAR_MIN_WIDTH + SNAP_THRESHOLD) {
                // Near minimum - apply resistance
                const overMin = SIDEBAR_MIN_WIDTH - newWidth;
                if (overMin > 0) {
                    newWidth = SIDEBAR_MIN_WIDTH - (overMin * SNAP_RESISTANCE);
                }
            } else if (newWidth > SIDEBAR_MAX_WIDTH - SNAP_THRESHOLD) {
                // Near maximum - apply resistance
                const overMax = newWidth - SIDEBAR_MAX_WIDTH;
                if (overMax > 0) {
                    newWidth = SIDEBAR_MAX_WIDTH + (overMax * SNAP_RESISTANCE);
                }
            }

            // Clamp to final bounds
            newWidth = Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, newWidth));

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

            // Remove will-change hint
            if (sidebarRef.current) {
                sidebarRef.current.style.willChange = '';
                sidebarRef.current = null;
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
            if (sidebarRef.current) {
                sidebarRef.current.style.willChange = '';
            }
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
        };
    }, [isDragging, setSidebarWidth]);

    return { sidebarWidth, isDragging, handleDragStart };
}
