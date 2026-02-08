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

    const [hoverTimeIndicator, setHoverTimeIndicator] = useState<TimeIndicator | null>(null);

    const triggerDragUpdateRef = useRef<(() => void) | null>(null);

    const handleBeforeCreate = useCallback(() => {
        if (editingEventId) {
            const editingEvent = displayItems.find(ev => ev.uid === editingEventId);
            if (editingEvent) {
                const hasContent = editingEvent.summary?.trim() || editingEvent.icon;
                if (!hasContent) {
                    deleteEvent(editingEventId);
                }
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

    const handleMouseMove = useCallback((e: MouseEvent) => {
        autoScroll.updateMousePosition(e.clientX, e.clientY);

        triggerDragUpdateRef.current = () => {
            if (dragToCreate.isDragging) {
                dragToCreate.handleMouseMove(e);
            }
            if (eventDrag.eventDrag) {
                eventDrag.handleMouseMove(e);
            }
        };

        if (dragToCreate.isDragging) {
            dragToCreate.handleMouseMove(e);
        }
        if (eventDrag.eventDrag) {
            eventDrag.handleMouseMove(e);
        }
    }, [autoScroll, dragToCreate, eventDrag]);

    const handleMouseUp = useCallback((e: MouseEvent) => {
        if (dragToCreate.isDragging) {
            dragToCreate.handleMouseUp(e);
        }
        if (eventDrag.eventDrag) {
            eventDrag.handleMouseUp(e);
        }
    }, [dragToCreate, eventDrag]);

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            dragToCreate.handleEscape();
            eventDrag.handleEscape();
        }
    }, [dragToCreate, eventDrag]);

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

    const handleEventHover = useCallback((startMinutes: number | null, endMinutes: number | null) => {
        if (!eventDrag.eventDrag && !dragToCreate.isDragging) {
            if (startMinutes !== null && endMinutes !== null) {
                setHoverTimeIndicator({ startMinutes, endMinutes });
            } else {
                setHoverTimeIndicator(null);
            }
        }
    }, [eventDrag.eventDrag, dragToCreate.isDragging]);

    const handleCreateAllDay = useCallback((startDay: Date, endDay: Date) => {
        const newEventId = addEvent({
            summary: '',
            dtstart: startOfDay(startDay),
            dtend: endOfDay(endDay),
            allDay: true,
        });
        setEditingEventId(newEventId);
    }, [addEvent, setEditingEventId]);

    const dragTimeIndicator = dragToCreate.dragTimeIndicator || eventDrag.dragTimeIndicator;

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