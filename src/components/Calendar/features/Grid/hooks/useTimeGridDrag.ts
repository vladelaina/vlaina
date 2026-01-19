/**
 * useTimeGridDrag - Unified time grid drag controller
 * 
 * Composes smaller hooks for a complete drag experience:
 * - useDragToCreate: Drag on canvas to create events
 * - useEventDrag: Drag/resize existing events
 * - useGridAutoScroll: Auto-scroll during drag
 * 
 * This is a facade that coordinates between the specialized hooks
 * and provides a single interface for the grid component.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { startOfDay, endOfDay } from 'date-fns';
import { useCalendarStore } from '@/stores/useCalendarStore';
import { getSnapMinutes } from '../../../utils/timeUtils';
import type { NekoEvent } from '@/stores/useCalendarStore';

import { useDragToCreate } from './useDragToCreate';
import { useEventDrag } from './useEventDrag';
import { useGridAutoScroll } from './useGridAutoScroll';
import type { TimeIndicator, TimeGridDragConfig } from './timeGridDragTypes';

interface UseTimeGridDragProps {
    days: Date[];
    displayItems: NekoEvent[];
    columnCount: number;
    hourHeight: number;
    dayStartMinutes: number;
    use24Hour: boolean;
    scrollRef: React.RefObject<HTMLDivElement | null>;
    canvasRef: React.RefObject<HTMLDivElement | null>;
    allDayAreaRef: React.RefObject<HTMLDivElement | null>;
}

export function useTimeGridDrag({
    days,
    displayItems,
    columnCount,
    hourHeight,
    dayStartMinutes,
    scrollRef,
    canvasRef,
    allDayAreaRef,
}: UseTimeGridDragProps) {
    const {
        addEvent,
        updateEvent,
        deleteEvent,
        setEditingEventId,
        closeEditingEvent,
        editingEventId
    } = useCalendarStore();

    const snapMinutes = getSnapMinutes(hourHeight);

    // Hover time indicator (managed at this level for coordination)
    const [hoverTimeIndicator, setHoverTimeIndicator] = useState<TimeIndicator | null>(null);

    // Ref to track when we need to update drag position during auto-scroll
    const triggerDragUpdateRef = useRef<(() => void) | null>(null);

    // -------------------------------------------------------------------------
    // Drag to Create Hook
    // -------------------------------------------------------------------------
    const handleBeforeCreate = useCallback(() => {
        if (editingEventId) {
            const editingEvent = displayItems.find(ev => ev.uid === editingEventId);
            if (editingEvent && !editingEvent.summary.trim()) {
                deleteEvent(editingEventId);
            }
        }
        closeEditingEvent();
    }, [editingEventId, displayItems, deleteEvent, closeEditingEvent]);

    const handleEventCreated = useCallback((startDate: Date, endDate: Date, position: { x: number; y: number }, uid?: string) => {
        const newEventId = addEvent({
            summary: '',
            dtstart: startDate,
            dtend: endDate,
            allDay: false,
            uid, // Use pre-generated UID if available
        });
        setEditingEventId(newEventId, position);
    }, [addEvent, setEditingEventId]);

    const dragToCreate = useDragToCreate({
        days,
        columnCount,
        hourHeight,
        dayStartMinutes,
        scrollRef,
        canvasRef,
        onEventCreated: handleEventCreated,
        onBeforeCreate: handleBeforeCreate,
    });

    // -------------------------------------------------------------------------
    // Event Drag Hook
    // -------------------------------------------------------------------------
    const eventDragConfig: Omit<TimeGridDragConfig, 'use24Hour'> = {
        days,
        displayItems,
        columnCount,
        hourHeight,
        dayStartMinutes,
        snapMinutes,
        scrollRef,
        canvasRef,
        allDayAreaRef,
    };

    const eventDrag = useEventDrag({
        config: eventDragConfig,
        displayItems,
        onUpdateEvent: updateEvent,
    });

    // -------------------------------------------------------------------------
    // Auto-scroll Hook
    // -------------------------------------------------------------------------
    const isAnyDragging = dragToCreate.isDragging || eventDrag.eventDrag !== null;

    const handleScrollUpdate = useCallback(() => {
        triggerDragUpdateRef.current?.();
    }, []);

    const autoScroll = useGridAutoScroll({
        isActive: isAnyDragging,
        scrollRef,
        allDayAreaRef,
        onScrollUpdate: handleScrollUpdate,
    });

    // -------------------------------------------------------------------------
    // Combined Mouse Move Handler
    // -------------------------------------------------------------------------
    const handleMouseMove = useCallback((e: MouseEvent) => {
        autoScroll.updateMousePosition(e.clientX, e.clientY);

        // Update the trigger ref for auto-scroll updates
        triggerDragUpdateRef.current = () => {
            if (dragToCreate.isDragging) {
                dragToCreate.handleMouseMove(e);
            }
            if (eventDrag.eventDrag) {
                eventDrag.handleMouseMove(e);
            }
        };

        // Process actual movement
        if (dragToCreate.isDragging) {
            dragToCreate.handleMouseMove(e);
        }
        if (eventDrag.eventDrag) {
            eventDrag.handleMouseMove(e);
        }
    }, [autoScroll, dragToCreate, eventDrag]);

    // -------------------------------------------------------------------------
    // Combined Mouse Up Handler
    // -------------------------------------------------------------------------
    const handleMouseUp = useCallback((e: MouseEvent) => {
        if (dragToCreate.isDragging) {
            dragToCreate.handleMouseUp(e);
        }
        if (eventDrag.eventDrag) {
            eventDrag.handleMouseUp(e);
        }
    }, [dragToCreate, eventDrag]);

    // -------------------------------------------------------------------------
    // Combined Keyboard Handler
    // -------------------------------------------------------------------------
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            dragToCreate.handleEscape();
            eventDrag.handleEscape();
        }
    }, [dragToCreate, eventDrag]);

    // -------------------------------------------------------------------------
    // Global Event Listeners
    // -------------------------------------------------------------------------
    useEffect(() => {
        if (isAnyDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            window.addEventListener('keydown', handleKeyDown);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isAnyDragging, handleMouseMove, handleMouseUp, handleKeyDown]);

    // -------------------------------------------------------------------------
    // Hover Time Indicator
    // -------------------------------------------------------------------------
    const handleEventHover = useCallback((startMinutes: number | null, endMinutes: number | null) => {
        if (!eventDrag.eventDrag && !dragToCreate.isDragging) {
            if (startMinutes !== null && endMinutes !== null) {
                setHoverTimeIndicator({ startMinutes, endMinutes });
            } else {
                setHoverTimeIndicator(null);
            }
        }
    }, [eventDrag.eventDrag, dragToCreate.isDragging]);

    // -------------------------------------------------------------------------
    // All-day Event Creation
    // -------------------------------------------------------------------------
    const handleCreateAllDay = useCallback((startDay: Date, endDay: Date) => {
        const newEventId = addEvent({
            summary: '',
            dtstart: startOfDay(startDay),
            dtend: endOfDay(endDay),
            allDay: true,
        });
        setEditingEventId(newEventId);
    }, [addEvent, setEditingEventId]);

    // -------------------------------------------------------------------------
    // Combined Drag Time Indicator
    // -------------------------------------------------------------------------
    const dragTimeIndicator = dragToCreate.dragTimeIndicator || eventDrag.dragTimeIndicator;

    // -------------------------------------------------------------------------
    // Return Value
    // -------------------------------------------------------------------------
    return {
        // Drag to create state
        isDragging: dragToCreate.isDragging,
        dragStart: dragToCreate.dragStart,
        dragEnd: dragToCreate.dragEnd,
        dragId: dragToCreate.dragId,

        // Event drag state
        eventDrag: eventDrag.eventDrag,
        isAllDayDropTarget: eventDrag.isAllDayDropTarget,

        // Time indicators
        dragTimeIndicator,
        hoverTimeIndicator,

        // Handlers
        handleCanvasMouseDown: dragToCreate.handleCanvasMouseDown,
        handleEventDragStart: eventDrag.handleEventDragStart,
        handleAllDayEventDragStart: eventDrag.handleAllDayEventDragStart,
        handleCreateAllDay,
        handleEventHover,
    };
}
