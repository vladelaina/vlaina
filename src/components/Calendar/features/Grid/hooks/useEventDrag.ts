import { useState, useCallback } from 'react';
import { startOfDay, endOfDay } from 'date-fns';
import type { EventDragState, TimeIndicator, TimeGridDragConfig } from './timeGridDragTypes';
import type { NekoEvent } from '@/lib/ics/types';
import {
    getSnapMinutes,
    pixelsToMinutes,
    pixelsDeltaToMinutes,
    getVisualDayBoundaries,
} from '../../../utils/timeUtils';

interface UseEventDragProps {
    config: Omit<TimeGridDragConfig, 'use24Hour'>;
    displayItems: NekoEvent[];
    onUpdateEvent: (uid: string, updates: Partial<NekoEvent>) => void;
}

interface UseEventDragReturn {
    eventDrag: EventDragState | null;
    isAllDayDropTarget: boolean;
    dragTimeIndicator: TimeIndicator | null;
    handleEventDragStart: (eventId: string, edge: 'top' | 'bottom' | null, clientY: number) => void;
    handleAllDayEventDragStart: (eventId: string, clientY: number) => void;
    handleMouseMove: (e: MouseEvent) => void;
    handleMouseUp: (e: MouseEvent) => void;
    handleEscape: () => void;
    clearHoverIndicator: () => void;
}

export function useEventDrag({
    config,
    displayItems,
    onUpdateEvent,
}: UseEventDragProps): UseEventDragReturn {
    const {
        days, columnCount, hourHeight, dayStartMinutes,
        snapMinutes: configSnapMinutes,
        scrollRef, canvasRef, allDayAreaRef
    } = config;

    const snapMinutes = configSnapMinutes || getSnapMinutes(hourHeight);

    const [eventDrag, setEventDrag] = useState<EventDragState | null>(null);
    const [isAllDayDropTarget, setIsAllDayDropTarget] = useState(false);
    const [dragTimeIndicator, setDragTimeIndicator] = useState<TimeIndicator | null>(null);

    const handleEventDragStart = useCallback((
        eventId: string,
        edge: 'top' | 'bottom' | null,
        clientY: number
    ) => {
        const event = displayItems.find(item => item.uid === eventId);
        if (!event) return;

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

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!eventDrag || !scrollRef.current || !canvasRef.current) return;

        const clientX = e.clientX;
        const clientY = e.clientY;

        if (allDayAreaRef.current) {
            const allDayRect = allDayAreaRef.current.getBoundingClientRect();
            const isInAllDayArea = clientY >= allDayRect.top && clientY <= allDayRect.bottom;
            if (isInAllDayArea && eventDrag.edge === null && !eventDrag.originalIsAllDay) {
                setIsAllDayDropTarget(true);
                return;
            }
            setIsAllDayDropTarget(false);
        }

        const event = displayItems.find(item => item.uid === eventDrag.eventId);
        if (!event) return;

        const canvasRect = canvasRef.current.getBoundingClientRect();
        const relativeX = clientX - canvasRect.left;
        const dayWidth = canvasRect.width / columnCount;
        const targetDayIndex = Math.max(0, Math.min(columnCount - 1, Math.floor(relativeX / dayWidth)));
        const targetDate = days[targetDayIndex];

        if (eventDrag.originalIsAllDay) {
            const scrollRect = scrollRef.current.getBoundingClientRect();
            const allDayRect = allDayAreaRef.current?.getBoundingClientRect();

            if (allDayRect && clientY > allDayRect.bottom) {
                const relativeY = clientY - scrollRect.top + scrollRef.current.scrollTop;
                const totalMinutes = pixelsToMinutes(relativeY, hourHeight, dayStartMinutes);
                let snappedMinutes = Math.round(totalMinutes / snapMinutes) * snapMinutes;
                snappedMinutes = Math.max(0, Math.min(1439, snappedMinutes));

                if (targetDate) {
                    const newStartDate = new Date(targetDate);
                    newStartDate.setHours(Math.floor(snappedMinutes / 60), snappedMinutes % 60, 0, 0);
                    const newEndDate = new Date(newStartDate.getTime() + 60 * 60 * 1000);

                    onUpdateEvent(eventDrag.eventId, {
                        allDay: false,
                        dtstart: newStartDate,
                        dtend: newEndDate,
                    });
                    setDragTimeIndicator({
                        startMinutes: snappedMinutes,
                        endMinutes: snappedMinutes + 60,
                    });
                }
            } else if (allDayRect && clientY <= allDayRect.bottom) {
                 onUpdateEvent(eventDrag.eventId, {
                    allDay: true,
                    dtstart: new Date(eventDrag.originalStart),
                    dtend: new Date(eventDrag.originalEnd),
                });
                setDragTimeIndicator(null);
            }
            return;
        }

        const scrollDelta = scrollRef.current.scrollTop - eventDrag.startScrollTop;
        const deltaY = clientY - eventDrag.startY + scrollDelta;
        
        const deltaMinutes = Math.round(pixelsDeltaToMinutes(deltaY, hourHeight) / snapMinutes) * snapMinutes;
        const deltaMs = deltaMinutes * 60 * 1000;

        const effectiveDateBase = (eventDrag.edge === null && targetDate) 
            ? targetDate.getTime() 
            : event.dtstart.getTime();

        const boundaries = getVisualDayBoundaries(effectiveDateBase, dayStartMinutes);
        const minDuration = Math.max(snapMinutes, 5) * 60 * 1000;

        if (eventDrag.edge === 'top') {
            const anchor = Math.max(boundaries.start, Math.min(boundaries.end, eventDrag.originalEnd));
            const draggedPosition = eventDrag.originalStart + deltaMs;
            const clampedPosition = Math.max(boundaries.start, Math.min(boundaries.end, draggedPosition));

            let newStart: number, newEnd: number;
            if (clampedPosition <= anchor) {
                newStart = clampedPosition;
                newEnd = anchor;
            } else {
                newStart = anchor;
                newEnd = clampedPosition;
            }

            // Ensure minimum duration
            if (newEnd - newStart < minDuration) {
                if (clampedPosition <= anchor) {
                    newStart = Math.max(boundaries.start, newEnd - minDuration);
                    if (newEnd - newStart < minDuration) {
                        newEnd = Math.min(boundaries.end, newStart + minDuration);
                    }
                } else {
                    newEnd = Math.min(boundaries.end, newStart + minDuration);
                    if (newEnd - newStart < minDuration) {
                        newStart = Math.max(boundaries.start, newEnd - minDuration);
                    }
                }
            }

            onUpdateEvent(eventDrag.eventId, {
                dtstart: new Date(newStart),
                dtend: new Date(newEnd),
            });
            setDragTimeIndicator({
                startMinutes: new Date(newStart).getHours() * 60 + new Date(newStart).getMinutes(),
                endMinutes: new Date(newEnd).getHours() * 60 + new Date(newEnd).getMinutes(),
            });

        } else if (eventDrag.edge === 'bottom') {
            const anchor = Math.max(boundaries.start, Math.min(boundaries.end, eventDrag.originalStart));
            const draggedPosition = eventDrag.originalEnd + deltaMs;
            const clampedPosition = Math.max(boundaries.start, Math.min(boundaries.end, draggedPosition));

            let newStart: number, newEnd: number;
            if (clampedPosition >= anchor) {
                newStart = anchor;
                newEnd = clampedPosition;
            } else {
                newStart = clampedPosition;
                newEnd = anchor;
            }

            if (newEnd - newStart < minDuration) {
                if (clampedPosition >= anchor) {
                    newEnd = Math.min(boundaries.end, newStart + minDuration);
                    if (newEnd - newStart < minDuration) {
                        newStart = Math.max(boundaries.start, newEnd - minDuration);
                    }
                } else {
                    newStart = Math.max(boundaries.start, newEnd - minDuration);
                    if (newEnd - newStart < minDuration) {
                        newEnd = Math.min(boundaries.end, newStart + minDuration);
                    }
                }
            }

            onUpdateEvent(eventDrag.eventId, {
                dtstart: new Date(newStart),
                dtend: new Date(newEnd),
            });
            setDragTimeIndicator({
                startMinutes: new Date(newStart).getHours() * 60 + new Date(newStart).getMinutes(),
                endMinutes: new Date(newEnd).getHours() * 60 + new Date(newEnd).getMinutes(),
            });

        } else {
            if (!targetDate) return;

            const duration = eventDrag.originalEnd - eventDrag.originalStart;
            
            const originalStartDate = new Date(eventDrag.originalStart);
            const originalStartTotalMinutes = originalStartDate.getHours() * 60 + originalStartDate.getMinutes();
            
            let newStartTotalMinutes = originalStartTotalMinutes + Math.round(deltaMs / 60000);
            
            const proposedStart = new Date(targetDate);
            proposedStart.setHours(Math.floor(newStartTotalMinutes / 60), newStartTotalMinutes % 60, 0, 0);
            
            const dayStartMs = dayStartMinutes * 60 * 1000;
            const boundaryStart = targetDate.getTime() + dayStartMs;
            const boundaryEnd = boundaryStart + (24 * 60 * 60 * 1000);
            
            const boundaries = { start: boundaryStart, end: boundaryEnd };
            
            let finalStart = proposedStart.getTime();
            let finalEnd = finalStart + duration;
            
            if (finalStart < boundaries.start) {
                finalStart = boundaries.start;
                finalEnd = finalStart + duration;
            }
            
            if (finalEnd > boundaries.end) {
                finalEnd = boundaries.end;
                finalStart = Math.max(boundaries.start, finalEnd - duration);
            }
            
            onUpdateEvent(eventDrag.eventId, {
                dtstart: new Date(finalStart),
                dtend: new Date(finalEnd),
            });
            
            setDragTimeIndicator({
                startMinutes: new Date(finalStart).getHours() * 60 + new Date(finalStart).getMinutes(),
                endMinutes: new Date(finalEnd).getHours() * 60 + new Date(finalEnd).getMinutes(),
            });
        }
    }, [eventDrag, displayItems, onUpdateEvent, hourHeight, snapMinutes, dayStartMinutes,
        columnCount, days, scrollRef, canvasRef, allDayAreaRef]);

    const handleMouseUp = useCallback(() => {
        if (!eventDrag) return;

        if (isAllDayDropTarget && eventDrag.edge === null && !eventDrag.originalIsAllDay) {
            const event = displayItems.find(item => item.uid === eventDrag.eventId);
            if (event) {
                onUpdateEvent(eventDrag.eventId, {
                    allDay: true,
                    dtstart: startOfDay(event.dtstart),
                    dtend: endOfDay(event.dtstart),
                });
            }
        }

        setEventDrag(null);
        setDragTimeIndicator(null);
        setIsAllDayDropTarget(false);
    }, [eventDrag, isAllDayDropTarget, displayItems, onUpdateEvent]);

    const handleEscape = useCallback(() => {
        if (eventDrag) {
            onUpdateEvent(eventDrag.eventId, {
                allDay: eventDrag.originalIsAllDay,
                dtstart: new Date(eventDrag.originalStart),
                dtend: new Date(eventDrag.originalEnd),
            });
            setEventDrag(null);
            setDragTimeIndicator(null);
            setIsAllDayDropTarget(false);
        }
    }, [eventDrag, onUpdateEvent]);

    const clearHoverIndicator = useCallback(() => {
    }, []);

    return {
        eventDrag,
        isAllDayDropTarget,
        dragTimeIndicator,
        handleEventDragStart,
        handleAllDayEventDragStart,
        handleMouseMove,
        handleMouseUp,
        handleEscape,
        clearHoverIndicator,
    };
}