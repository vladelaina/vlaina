/**
 * useDragToCreate - Drag to create new events
 * 
 * Handles the interaction of dragging on the calendar canvas
 * to create a new event with a specific time range.
 */

import { useState, useCallback } from 'react';
import type { DragPosition, TimeIndicator } from './timeGridDragTypes';
import {
    getSnapMinutes,
    pixelsToMinutes,
    minutesToDisplayPosition,
} from '../../../utils/timeUtils';
import { calculateDragEventTimes } from '../../../utils/dragUtils';

interface UseDragToCreateProps {
    days: Date[];
    columnCount: number;
    hourHeight: number;
    dayStartMinutes: number;
    scrollRef: React.RefObject<HTMLDivElement | null>;
    canvasRef: React.RefObject<HTMLDivElement | null>;
    onEventCreated: (startDate: Date, endDate: Date, position: { x: number; y: number }, dragId?: string) => void;
    onBeforeCreate?: () => void;
}

interface UseDragToCreateReturn {
    isDragging: boolean;
    dragStart: DragPosition | null;
    dragEnd: { minutes: number } | null;
    dragId: string | null;
    dragTimeIndicator: TimeIndicator | null;
    handleCanvasMouseDown: (e: React.MouseEvent) => void;
    handleMouseMove: (e: MouseEvent) => void;
    handleMouseUp: (e: MouseEvent) => void;
    handleEscape: () => void;
}

export function useDragToCreate({
    days,
    columnCount,
    hourHeight,
    dayStartMinutes,
    scrollRef,
    canvasRef,
    onEventCreated,
    onBeforeCreate,
}: UseDragToCreateProps): UseDragToCreateReturn {
    const snapMinutes = getSnapMinutes(hourHeight);

    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState<DragPosition | null>(null);
    const [dragEnd, setDragEnd] = useState<{ minutes: number } | null>(null);
    const [dragTimeIndicator, setDragTimeIndicator] = useState<TimeIndicator | null>(null);
    const [dragId, setDragId] = useState<string | null>(null);

    // Helper: Get position from mouse coordinates
    const getPositionFromMouse = useCallback((clientX: number, clientY: number): DragPosition | null => {
        if (!canvasRef.current || !scrollRef.current) return null;

        const rect = canvasRef.current.getBoundingClientRect();
        const scrollRect = scrollRef.current.getBoundingClientRect();

        const relativeX = clientX - rect.left;
        const dayWidth = rect.width / columnCount;
        const dayIndex = Math.floor(relativeX / dayWidth);

        if (dayIndex < 0 || dayIndex >= columnCount) return null;

        const relativeY = clientY - scrollRect.top + scrollRef.current.scrollTop;
        const totalMinutes = pixelsToMinutes(relativeY, hourHeight, dayStartMinutes);
        let snappedMinutes = Math.round(totalMinutes / snapMinutes) * snapMinutes;
        snappedMinutes = Math.max(0, Math.min(1439, snappedMinutes));

        return { dayIndex, minutes: snappedMinutes };
    }, [columnCount, hourHeight, snapMinutes, dayStartMinutes, canvasRef, scrollRef]);

    const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
        if (e.button !== 0) return;
        if ((e.target as HTMLElement).closest('.event-block')) return;

        const pos = getPositionFromMouse(e.clientX, e.clientY);
        if (!pos) return;

        onBeforeCreate?.();

        setIsDragging(true);
        setDragStart(pos);
        setDragEnd({ minutes: pos.minutes });
        setDragId(crypto.randomUUID());
        setDragTimeIndicator({
            startMinutes: pos.minutes,
            endMinutes: pos.minutes,
        });
    }, [getPositionFromMouse, onBeforeCreate]);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isDragging || !dragStart || !scrollRef.current) return;

        const scrollRect = scrollRef.current.getBoundingClientRect();
        const relativeY = e.clientY - scrollRect.top + scrollRef.current.scrollTop;
        const totalMinutes = pixelsToMinutes(relativeY, hourHeight, dayStartMinutes);
        
        let snappedMinutes = Math.round(totalMinutes / snapMinutes) * snapMinutes;
        snappedMinutes = Math.max(0, Math.min(1439, snappedMinutes));

        setDragEnd({ minutes: snappedMinutes });

        // Calculate visual start/end for indicator
        const startPos = minutesToDisplayPosition(dragStart.minutes, dayStartMinutes);
        const endPos = minutesToDisplayPosition(snappedMinutes, dayStartMinutes);
        
        let startMin, endMin;
        if (startPos <= endPos) {
            startMin = dragStart.minutes;
            endMin = snappedMinutes;
        } else {
            startMin = snappedMinutes;
            endMin = dragStart.minutes;
        }

        setDragTimeIndicator({
            startMinutes: startMin,
            endMinutes: endMin,
        });
    }, [isDragging, dragStart, hourHeight, snapMinutes, dayStartMinutes, scrollRef]);

    const handleMouseUp = useCallback((e: MouseEvent) => {
        if (!isDragging || !dragStart || !dragEnd) return;

        setIsDragging(false);

        if (dragStart.minutes !== dragEnd.minutes) {
            const dayDate = days[dragStart.dayIndex];
            if (!dayDate) {
                setDragStart(null);
                setDragEnd(null);
                setDragTimeIndicator(null);
                setDragId(null);
                return;
            }

            const { startDate, endDate, isValid } = calculateDragEventTimes(
                dragStart.minutes,
                dragEnd.minutes,
                dayDate,
                dayStartMinutes
            );

            if (!isValid) {
                setDragStart(null);
                setDragEnd(null);
                setDragTimeIndicator(null);
                setDragId(null);
                return;
            }

// Pass the pre-generated dragId to the creation callback
            if (dragId) {
                onEventCreated(startDate, endDate, { x: e.clientX, y: e.clientY }, dragId);
            }
        }

        setDragStart(null);
        setDragEnd(null);
        setDragTimeIndicator(null);
        setDragId(null);
    }, [isDragging, dragStart, dragEnd, dragId, days, dayStartMinutes, onEventCreated]);

    const handleEscape = useCallback(() => {
        if (isDragging) {
            setIsDragging(false);
            setDragStart(null);
            setDragEnd(null);
            setDragTimeIndicator(null);
            setDragId(null);
        }
    }, [isDragging]);

    return {
        isDragging,
        dragStart,
        dragEnd,
        dragId, // Export dragId
        dragTimeIndicator,
        handleCanvasMouseDown,
        handleMouseMove,
        handleMouseUp,
        handleEscape,
    };
}