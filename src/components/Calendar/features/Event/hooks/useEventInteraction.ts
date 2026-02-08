import { useState, useCallback } from 'react';
import { useCalendarStore } from '@/stores/useCalendarStore';
import { CALENDAR_CONSTANTS } from '../../../utils/timeUtils';

const RESIZE_HANDLE_HEIGHT = CALENDAR_CONSTANTS.RESIZE_HANDLE_HEIGHT as number;

interface UseEventInteractionProps {
  eventId: string;
  onDragStart?: (eventId: string, edge: 'top' | 'bottom' | null, clientY: number) => void;
  onHover?: (startMinutes: number | null, endMinutes: number | null) => void;
  eventStart: Date;
  eventEnd: Date;
}

export function useEventInteraction({
  eventId,
  onDragStart,
  onHover,
  eventStart,
  eventEnd,
}: UseEventInteractionProps) {
  const {
    setEditingEventId,
    editingEventId,
    setSelectedEventId,
    closeEditingEvent,
    deleteEvent,
    allEvents,
  } = useCalendarStore();

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [resizeEdge, setResizeEdge] = useState<'top' | 'bottom' | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const relativeY = e.clientY - rect.top;

    if (relativeY <= RESIZE_HANDLE_HEIGHT) {
      setResizeEdge('top');
    } else if (relativeY >= rect.height - RESIZE_HANDLE_HEIGHT) {
      setResizeEdge('bottom');
    } else {
      setResizeEdge(null);
    }
  }, [isDragging]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const startY = e.clientY;
    const LONG_PRESS_DELAY = 150;
    let longPressTimer: ReturnType<typeof setTimeout> | null = null;

    longPressTimer = setTimeout(() => {
      setIsDragging(true);
      onDragStart?.(eventId, resizeEdge, startY);
    }, LONG_PRESS_DELAY);

    const handleMouseUp = () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
      setIsDragging(false);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mouseup', handleMouseUp);
  }, [eventId, resizeEdge, onDragStart]);

  const handleClick = useCallback(() => {
    if (isDragging) return;
    if (resizeEdge) return;

    if (editingEventId && editingEventId !== eventId) {
      const editingEvent = allEvents.find(ev => ev.uid === editingEventId);
      if (editingEvent) {
        const hasContent = editingEvent.summary?.trim() || editingEvent.icon;
        if (!hasContent) {
          deleteEvent(editingEventId);
        }
      }
      closeEditingEvent();
    }

    setSelectedEventId(eventId);
    setEditingEventId(eventId);
  }, [isDragging, resizeEdge, editingEventId, eventId, closeEditingEvent, setSelectedEventId, setEditingEventId, deleteEvent, allEvents]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
    const startMinutes = eventStart.getHours() * 60 + eventStart.getMinutes();
    const endMinutes = eventEnd.getHours() * 60 + eventEnd.getMinutes();
    onHover?.(startMinutes, endMinutes);
  }, [eventStart, eventEnd, onHover]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    if (!isDragging) {
      setResizeEdge(null);
    }
    onHover?.(null, null);
  }, [isDragging, onHover]);

  return {
    contextMenu,
    setContextMenu,
    isHovered,
    resizeEdge,
    isDragging,
    handleMouseMove,
    handleMouseDown,
    handleClick,
    handleContextMenu,
    handleMouseEnter,
    handleMouseLeave,
  };
}
