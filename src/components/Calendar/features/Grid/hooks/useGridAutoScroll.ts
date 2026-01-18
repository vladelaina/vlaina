/**
 * useGridAutoScroll - Auto-scroll during drag operations
 * 
 * Handles automatic scrolling when the mouse approaches the edges
 * of the scrollable container during drag operations.
 */

import { useEffect, useRef, useCallback } from 'react';
import type { AutoScrollState } from './timeGridDragTypes';
import { createAutoScrollState, stopAutoScroll } from './timeGridDragTypes';

const EDGE_THRESHOLD = 80;
const MAX_SCROLL_SPEED = 15;

interface UseGridAutoScrollProps {
    isActive: boolean;
    scrollRef: React.RefObject<HTMLDivElement | null>;
    allDayAreaRef: React.RefObject<HTMLDivElement | null>;
    onScrollUpdate?: () => void;
}

export function useGridAutoScroll({
    isActive,
    scrollRef,
    allDayAreaRef,
    onScrollUpdate,
}: UseGridAutoScrollProps) {
    const autoScrollRef = useRef<AutoScrollState>(createAutoScrollState());
    const onScrollUpdateRef = useRef(onScrollUpdate);

    // Keep callback ref updated
    useEffect(() => {
        onScrollUpdateRef.current = onScrollUpdate;
    }, [onScrollUpdate]);

    const updateMousePosition = useCallback((clientX: number, clientY: number) => {
        autoScrollRef.current.lastMouseX = clientX;
        autoScrollRef.current.lastMouseY = clientY;
    }, []);

    useEffect(() => {
        if (!isActive) {
            stopAutoScroll(autoScrollRef.current);
            return;
        }

        const handleAutoScroll = () => {
            if (!scrollRef.current) {
                autoScrollRef.current.rafId = requestAnimationFrame(handleAutoScroll);
                return;
            }

            const scrollRect = scrollRef.current.getBoundingClientRect();
            const allDayRect = allDayAreaRef.current?.getBoundingClientRect();
            const mouseY = autoScrollRef.current.lastMouseY;
            let scrollAmount = 0;

            const topEdge = allDayRect ? allDayRect.bottom : scrollRect.top;

            if (mouseY < topEdge + EDGE_THRESHOLD && mouseY > topEdge - 20) {
                const distance = topEdge + EDGE_THRESHOLD - mouseY;
                scrollAmount = -Math.ceil((distance / EDGE_THRESHOLD) * MAX_SCROLL_SPEED);
            } else if (mouseY > scrollRect.bottom - EDGE_THRESHOLD && mouseY < scrollRect.bottom + 50) {
                const distance = mouseY - (scrollRect.bottom - EDGE_THRESHOLD);
                scrollAmount = Math.ceil((distance / EDGE_THRESHOLD) * MAX_SCROLL_SPEED);
            }

            if (scrollAmount !== 0) {
                scrollRef.current.scrollTop += scrollAmount;
                autoScrollRef.current.isScrolling = true;
                onScrollUpdateRef.current?.();
            } else {
                autoScrollRef.current.isScrolling = false;
            }

            autoScrollRef.current.rafId = requestAnimationFrame(handleAutoScroll);
        };

        autoScrollRef.current.rafId = requestAnimationFrame(handleAutoScroll);

        return () => stopAutoScroll(autoScrollRef.current);
    }, [isActive, scrollRef, allDayAreaRef]);

    return {
        updateMousePosition,
        isScrolling: autoScrollRef.current.isScrolling,
    };
}
