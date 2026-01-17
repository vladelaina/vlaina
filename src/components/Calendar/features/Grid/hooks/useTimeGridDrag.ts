import { useState, useCallback, useRef, useEffect } from 'react';
import { startOfDay, endOfDay } from 'date-fns';
import { useCalendarStore } from '@/stores/useCalendarStore';
import {
    getSnapMinutes,
    pixelsToMinutes,
    pixelsDeltaToMinutes,
    getVisualDayBoundaries
} from '../../../utils/timeUtils';
import type { NekoEvent } from '@/stores/useCalendarStore';

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

    const snapMinutes = getSnapMinutes(hourHeight); // Usually 15

    // Drag-to-create state
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState<{ dayIndex: number; minutes: number } | null>(null);
    const [dragEnd, setDragEnd] = useState<{ minutes: number } | null>(null);

    // Event drag state
    const [eventDrag, setEventDrag] = useState<{
        eventId: string;
        edge: 'top' | 'bottom' | null;
        startY: number;
        startScrollTop: number;
        originalStart: number;
        originalEnd: number;
        originalIsAllDay: boolean;
    } | null>(null);

    // All-day drop target state
    const [isAllDayDropTarget, setIsAllDayDropTarget] = useState(false);

    // Current drag time indicators
    const [dragTimeIndicator, setDragTimeIndicator] = useState<{
        startMinutes: number;
        endMinutes: number;
    } | null>(null);

    // Hover time indicator
    const [hoverTimeIndicator, setHoverTimeIndicator] = useState<{
        startMinutes: number;
        endMinutes: number;
    } | null>(null);

    // Auto-scroll logic
    const autoScrollRef = useRef<{
        rafId: number | null;
        lastMouseX: number;
        lastMouseY: number;
        isScrolling: boolean;
    }>({
        rafId: null,
        lastMouseX: 0,
        lastMouseY: 0,
        isScrolling: false
    });

    const triggerDragUpdateRef = useRef<(() => void) | null>(null);

    // -------------------------------------------------------------------------
    // Auto-scroll Implementation
    // -------------------------------------------------------------------------
    useEffect(() => {
        const isAnyDragging = isDragging || eventDrag !== null;

        if (!isAnyDragging) {
            if (autoScrollRef.current.rafId !== null) {
                cancelAnimationFrame(autoScrollRef.current.rafId);
                autoScrollRef.current.rafId = null;
            }
            autoScrollRef.current.isScrolling = false;
            return;
        }

        const EDGE_THRESHOLD = 80;
        const MAX_SCROLL_SPEED = 15;

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
                if (triggerDragUpdateRef.current) {
                    triggerDragUpdateRef.current();
                }
            } else {
                autoScrollRef.current.isScrolling = false;
            }

            autoScrollRef.current.rafId = requestAnimationFrame(handleAutoScroll);
        };

        autoScrollRef.current.rafId = requestAnimationFrame(handleAutoScroll);

        return () => {
            if (autoScrollRef.current.rafId !== null) {
                cancelAnimationFrame(autoScrollRef.current.rafId);
                autoScrollRef.current.rafId = null;
            }
        };
    }, [isDragging, eventDrag, scrollRef, allDayAreaRef]);


    // -------------------------------------------------------------------------
    // Helper: Position Calculation
    // -------------------------------------------------------------------------
    const getPositionFromMouse = useCallback((clientX: number, clientY: number) => {
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


    // -------------------------------------------------------------------------
    // Handlers
    // -------------------------------------------------------------------------

    const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
        if (e.button !== 0) return;
        if ((e.target as HTMLElement).closest('.event-block')) return;

        const pos = getPositionFromMouse(e.clientX, e.clientY);
        if (!pos) return;

        if (editingEventId) {
            const editingEvent = displayItems.find(ev => ev.uid === editingEventId);
            if (editingEvent && !editingEvent.summary.trim()) {
                deleteEvent(editingEventId);
            }
        }

        closeEditingEvent();
        setIsDragging(true);
        setDragStart(pos);
        setDragEnd({ minutes: pos.minutes });
        setDragTimeIndicator({
            startMinutes: pos.minutes,
            endMinutes: pos.minutes,
        });
    }, [getPositionFromMouse, closeEditingEvent, editingEventId, displayItems, deleteEvent]);


    const handleMouseMove = useCallback((e: MouseEvent) => {
        autoScrollRef.current.lastMouseX = e.clientX;
        autoScrollRef.current.lastMouseY = e.clientY;

        const updateDragPosition = (clientX: number, clientY: number) => {
            // Check AllDay drop target
            if (eventDrag && allDayAreaRef.current) {
                const allDayRect = allDayAreaRef.current.getBoundingClientRect();
                const isInAllDayArea = clientY >= allDayRect.top && clientY <= allDayRect.bottom;
                setIsAllDayDropTarget(isInAllDayArea && eventDrag.edge === null && !eventDrag.originalIsAllDay);
            }

            // 1. Drag to create
            if (isDragging && dragStart && scrollRef.current) {
                const scrollRect = scrollRef.current.getBoundingClientRect();
                const relativeY = clientY - scrollRect.top + scrollRef.current.scrollTop;
                const totalMinutes = pixelsToMinutes(relativeY, hourHeight, dayStartMinutes);
                let snappedMinutes = Math.round(totalMinutes / snapMinutes) * snapMinutes;
                snappedMinutes = Math.max(0, Math.min(1439, snappedMinutes));

                setDragEnd({ minutes: snappedMinutes });

                const startMin = Math.min(dragStart.minutes, snappedMinutes);
                const endMin = Math.max(dragStart.minutes, snappedMinutes);
                setDragTimeIndicator({
                    startMinutes: startMin,
                    endMinutes: endMin,
                });
            }

            // 2. Event Drag
            if (eventDrag && scrollRef.current) {
                if (eventDrag.originalIsAllDay) {
                    // Logic for all-day -> timed handled here
                    /* Note: Simplified for hook extraction (assuming logic is similar as kept in component) 
                       Actually, full logic needs to be here. */
                    const scrollRect = scrollRef.current.getBoundingClientRect();
                    const allDayRect = allDayAreaRef.current?.getBoundingClientRect();

                    if (allDayRect && clientY > allDayRect.bottom && canvasRef.current) {
                        // Converted to timed
                        const relativeY = clientY - scrollRect.top + scrollRef.current.scrollTop;
                        const totalMinutes = pixelsToMinutes(relativeY, hourHeight, dayStartMinutes);
                        let snappedMinutes = Math.round(totalMinutes / snapMinutes) * snapMinutes;
                        snappedMinutes = Math.max(0, Math.min(1439, snappedMinutes));

                        const canvasRect = canvasRef.current.getBoundingClientRect();
                        const relativeX = clientX - canvasRect.left;
                        const dayWidth = canvasRect.width / columnCount;
                        const dayIndex = Math.max(0, Math.min(columnCount - 1, Math.floor(relativeX / dayWidth)));

                        const event = displayItems.find(item => item.uid === eventDrag.eventId);
                        if (event) {
                            const targetDay = days[dayIndex];
                            if (targetDay) {
                                const newStartDate = new Date(targetDay);
                                newStartDate.setHours(Math.floor(snappedMinutes / 60), snappedMinutes % 60, 0, 0);
                                const newEndDate = new Date(newStartDate.getTime() + 60 * 60 * 1000);

                                updateEvent(eventDrag.eventId, {
                                    allDay: false,
                                    dtstart: newStartDate,
                                    dtend: newEndDate,
                                });
                                setDragTimeIndicator({
                                    startMinutes: snappedMinutes,
                                    endMinutes: snappedMinutes + 60,
                                });
                            }
                        }
                    } else if (allDayRect && clientY <= allDayRect.bottom) {
                        // Revert to all day
                        const event = displayItems.find(item => item.uid === eventDrag.eventId);
                        if (event && !event.allDay) {
                            updateEvent(eventDrag.eventId, {
                                allDay: true,
                                dtstart: new Date(eventDrag.originalStart),
                                dtend: new Date(eventDrag.originalEnd),
                            });
                        }
                        setDragTimeIndicator(null);
                    }
                    return;
                }

                // Standard event drag
                const scrollDelta = scrollRef.current.scrollTop - eventDrag.startScrollTop;
                const deltaY = clientY - eventDrag.startY + scrollDelta;
                const deltaMinutes = Math.round(pixelsDeltaToMinutes(deltaY, hourHeight) / snapMinutes) * snapMinutes;
                const deltaMs = deltaMinutes * 60 * 1000;

                const event = displayItems.find(item => item.uid === eventDrag.eventId);
                if (!event) return;

                const boundaries = getVisualDayBoundaries(event.dtstart.getTime(), dayStartMinutes);
                const minDuration = Math.max(snapMinutes, 5) * 60 * 1000;

                if (eventDrag.edge === 'top') {
                    const anchor = Math.max(boundaries.start, Math.min(boundaries.end, eventDrag.originalEnd));
                    const draggedPosition = eventDrag.originalStart + deltaMs;
                    const clampedPosition = Math.max(boundaries.start, Math.min(boundaries.end, draggedPosition));

                    let newStart, newEnd;
                    if (clampedPosition <= anchor) {
                        newStart = clampedPosition; newEnd = anchor;
                    } else {
                        newStart = anchor; newEnd = clampedPosition;
                    }

                    if (newEnd - newStart < minDuration) {
                        if (clampedPosition <= anchor) {
                            newStart = Math.max(boundaries.start, newEnd - minDuration);
                            if (newEnd - newStart < minDuration) newEnd = Math.min(boundaries.end, newStart + minDuration);
                        } else {
                            newEnd = Math.min(boundaries.end, newStart + minDuration);
                            if (newEnd - newStart < minDuration) newStart = Math.max(boundaries.start, newEnd - minDuration);
                        }
                    }
                    updateEvent(eventDrag.eventId, { dtstart: new Date(newStart), dtend: new Date(newEnd) });
                    setDragTimeIndicator({
                        startMinutes: new Date(newStart).getHours() * 60 + new Date(newStart).getMinutes(),
                        endMinutes: new Date(newEnd).getHours() * 60 + new Date(newEnd).getMinutes(),
                    });
                } else if (eventDrag.edge === 'bottom') {
                    const anchor = Math.max(boundaries.start, Math.min(boundaries.end, eventDrag.originalStart));
                    const draggedPosition = eventDrag.originalEnd + deltaMs;
                    const clampedPosition = Math.max(boundaries.start, Math.min(boundaries.end, draggedPosition));

                    let newStart, newEnd;
                    if (clampedPosition >= anchor) {
                        newStart = anchor; newEnd = clampedPosition;
                    } else {
                        newStart = clampedPosition; newEnd = anchor;
                    }

                    if (newEnd - newStart < minDuration) {
                        if (clampedPosition >= anchor) {
                            newEnd = Math.min(boundaries.end, newStart + minDuration);
                            if (newEnd - newStart < minDuration) newStart = Math.max(boundaries.start, newEnd - minDuration);
                        } else {
                            newStart = Math.max(boundaries.start, newEnd - minDuration);
                            if (newEnd - newStart < minDuration) newEnd = Math.min(boundaries.end, newStart + minDuration);
                        }
                    }
                    updateEvent(eventDrag.eventId, { dtstart: new Date(newStart), dtend: new Date(newEnd) });
                    setDragTimeIndicator({
                        startMinutes: new Date(newStart).getHours() * 60 + new Date(newStart).getMinutes(),
                        endMinutes: new Date(newEnd).getHours() * 60 + new Date(newEnd).getMinutes(),
                    });
                } else {
                    // Move entire event
                    const newStart = eventDrag.originalStart + deltaMs;
                    const newEnd = eventDrag.originalEnd + deltaMs;
                    const eventDuration = eventDrag.originalEnd - eventDrag.originalStart;

                    let clampedStart = newStart;
                    let clampedEnd = newEnd;

                    if (newStart < boundaries.start) {
                        clampedStart = boundaries.start;
                        clampedEnd = boundaries.start + eventDuration;
                    } else if (newEnd > boundaries.end) {
                        clampedEnd = boundaries.end;
                        clampedStart = boundaries.end - eventDuration;
                    }

                    if (clampedStart >= boundaries.start && clampedEnd <= boundaries.end) {
                        updateEvent(eventDrag.eventId, {
                            dtstart: new Date(clampedStart),
                            dtend: new Date(clampedEnd)
                        });
                        setDragTimeIndicator({
                            startMinutes: new Date(clampedStart).getHours() * 60 + new Date(clampedStart).getMinutes(),
                            endMinutes: new Date(clampedEnd).getHours() * 60 + new Date(clampedEnd).getMinutes(),
                        });
                    }
                }
            }
        };

        triggerDragUpdateRef.current = () => {
            updateDragPosition(autoScrollRef.current.lastMouseX, autoScrollRef.current.lastMouseY);
        };

        updateDragPosition(e.clientX, e.clientY);
    }, [isDragging, dragStart, dragEnd, eventDrag, hourHeight, snapMinutes, displayItems, updateEvent, dayStartMinutes, columnCount, days, scrollRef, allDayAreaRef, canvasRef]);


    const handleMouseUp = useCallback((e: MouseEvent) => {
        if (isDragging && dragStart && dragEnd) {
            setIsDragging(false);

            if (dragStart.minutes !== dragEnd.minutes) {
                const dayDate = days[dragStart.dayIndex];
                if (!dayDate) {
                    setDragStart(null); setDragEnd(null); setDragTimeIndicator(null); return;
                }

                const actualStartMinutes = Math.min(dragStart.minutes, dragEnd.minutes);
                const actualEndMinutes = Math.max(dragStart.minutes, dragEnd.minutes);
                let startDate: Date, endDate: Date;

                const startBeforeDayStart = actualStartMinutes < dayStartMinutes;
                const endBeforeDayStart = actualEndMinutes < dayStartMinutes;

                if (startBeforeDayStart && !endBeforeDayStart) {
                    setDragStart(null); setDragEnd(null); setDragTimeIndicator(null); return;
                }

                if (startBeforeDayStart) {
                    startDate = new Date(dayDate); startDate.setDate(startDate.getDate() + 1); startDate.setHours(Math.floor(actualStartMinutes / 60), actualStartMinutes % 60, 0, 0);
                } else {
                    startDate = new Date(dayDate); startDate.setHours(Math.floor(actualStartMinutes / 60), actualStartMinutes % 60, 0, 0);
                }

                if (endBeforeDayStart) {
                    endDate = new Date(dayDate); endDate.setDate(endDate.getDate() + 1); endDate.setHours(Math.floor(actualEndMinutes / 60), actualEndMinutes % 60, 0, 0);
                } else {
                    endDate = new Date(dayDate); endDate.setHours(Math.floor(actualEndMinutes / 60), actualEndMinutes % 60, 0, 0);
                }

                const newEventId = addEvent({
                    summary: '',
                    dtstart: startDate,
                    dtend: endDate,
                    allDay: false,
                });

                setEditingEventId(newEventId, { x: e.clientX, y: e.clientY });
            }
            setDragStart(null); setDragEnd(null); setDragTimeIndicator(null);
        }

        if (eventDrag) {
            if (isAllDayDropTarget && eventDrag.edge === null && !eventDrag.originalIsAllDay) {
                const event = displayItems.find(item => item.uid === eventDrag.eventId);
                if (event) {
                    updateEvent(eventDrag.eventId, {
                        allDay: true,
                        dtstart: startOfDay(event.dtstart),
                        dtend: endOfDay(event.dtstart)
                    });
                }
            }
            setEventDrag(null);
            setDragTimeIndicator(null);
            setIsAllDayDropTarget(false);
        }
    }, [isDragging, dragStart, dragEnd, eventDrag, days, addEvent, setEditingEventId, dayStartMinutes, isAllDayDropTarget, displayItems, updateEvent]);


    const handleEventDragStart = useCallback((eventId: string, edge: 'top' | 'bottom' | null, clientY: number) => {
        const event = displayItems.find(item => item.uid === eventId);
        if (!event) return;
        setHoverTimeIndicator(null);
        setDragTimeIndicator({
            startMinutes: event.dtstart.getHours() * 60 + event.dtstart.getMinutes(),
            endMinutes: event.dtend.getHours() * 60 + event.dtend.getMinutes(),
        });
        setEventDrag({
            eventId,
            edge,
            startY: clientY,
            startScrollTop: scrollRef.current?.scrollTop || 0,
            originalStart: event.dtstart.getTime(),
            originalEnd: event.dtend.getTime(),
            originalIsAllDay: event.allDay,
        });
    }, [displayItems, scrollRef]);

    const handleCreateAllDay = useCallback((startDay: Date, endDay: Date) => {
        const newEventId = addEvent({
            summary: '',
            dtstart: startOfDay(startDay),
            dtend: endOfDay(endDay),
            allDay: true,
        });
        setEditingEventId(newEventId);
    }, [addEvent, setEditingEventId]);

    const handleAllDayEventDragStart = useCallback((eventId: string, clientY: number) => {
        const event = displayItems.find(item => item.uid === eventId);
        if (!event) return;
        setEventDrag({
            eventId,
            edge: null,
            startY: clientY,
            startScrollTop: scrollRef.current?.scrollTop || 0,
            originalStart: event.dtstart.getTime(),
            originalEnd: event.dtend.getTime(),
            originalIsAllDay: true,
        });
    }, [displayItems, scrollRef]);

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            if (isDragging) {
                setIsDragging(false);
                setDragStart(null); setDragEnd(null); setDragTimeIndicator(null);
            }
            if (eventDrag) {
                updateEvent(eventDrag.eventId, {
                    allDay: eventDrag.originalIsAllDay,
                    dtstart: new Date(eventDrag.originalStart),
                    dtend: new Date(eventDrag.originalEnd),
                });
                setEventDrag(null);
                setDragTimeIndicator(null);
                setIsAllDayDropTarget(false);
            }
        }
    }, [isDragging, eventDrag, updateEvent]);

    // Global listeners
    useEffect(() => {
        if (isDragging || eventDrag) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            window.addEventListener('keydown', handleKeyDown);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isDragging, eventDrag, handleMouseMove, handleMouseUp, handleKeyDown]);


    const handleEventHover = useCallback((startMinutes: number | null, endMinutes: number | null) => {
        if (!eventDrag && !isDragging) {
            if (startMinutes !== null && endMinutes !== null) {
                setHoverTimeIndicator({ startMinutes, endMinutes });
            } else {
                setHoverTimeIndicator(null);
            }
        }
    }, [eventDrag, isDragging]);


    return {
        isDragging,
        dragStart,
        dragEnd,
        eventDrag,
        isAllDayDropTarget,
        dragTimeIndicator,
        hoverTimeIndicator,
        handleCanvasMouseDown,
        handleEventDragStart,
        handleAllDayEventDragStart,
        handleCreateAllDay,
        handleEventHover,
    };
}
