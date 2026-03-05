import { useState, useRef, useEffect } from 'react';
import { useCalendarStore } from '@/stores/useCalendarStore';
import { useIconPreview } from '@/components/common/UniversalIconPicker/useIconPreview';
import type { ItemColor } from '@/lib/colors';

export function useEventContextMenu(eventId: string, position: { x: number; y: number }) {
  const { updateEvent, deleteEvent, events, addEvent, startTimer, pauseTimer, resumeTimer, stopTimer, setEditingEventId } = useCalendarStore();
  const [eventName, setEventName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  
  const { handlePreviewColor } = useIconPreview(eventId);
  const event = events.find(e => e.uid === eventId);

  useEffect(() => {
    if (event) {
      setEventName(event.summary || '');
    }
  }, [event]);

  useEffect(() => {
    setEditingEventId(eventId, position);
  }, [eventId, position, setEditingEventId]);

  const handleColorChange = (color: ItemColor) => {
    updateEvent(eventId, { color });
    handlePreviewColor(null);
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEventName(e.target.value);
  };

  const handleNameBlur = () => {
    if (eventName.trim() !== event?.summary) {
      const newSummary = eventName.trim();
      const fallback = event?.icon ? '' : 'Untitled';
      updateEvent(eventId, { summary: newSummary || fallback });
    }
  };

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const newSummary = eventName.trim();
      const fallback = event?.icon ? '' : 'Untitled';
      updateEvent(eventId, { summary: newSummary || fallback });
      inputRef.current?.blur();
    } else if (e.key === 'Escape') {
      setEventName(event?.summary || '');
      inputRef.current?.blur();
    }
  };

  const handleDelete = (onClose: () => void) => {
    deleteEvent(eventId);
    onClose();
  };

  const writeClipboard = async (text: string) => {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Ignore clipboard permission/runtime failures.
    }
  };

  const handleCopy = async (onClose: () => void) => {
    if (event) {
      const text = event.summary?.trim() || '';
      if (text) {
        await writeClipboard(text);
      }
    }
    onClose();
  };

  const handleCut = async (onClose: () => void) => {
    if (event) {
      const text = event.summary?.trim() || '';
      if (text) {
        await writeClipboard(text);
      }
    }
    deleteEvent(eventId);
    onClose();
  };

  const handleDuplicate = (onClose: () => void) => {
    if (event) {
      addEvent({
        summary: event.summary,
        dtstart: event.dtstart,
        dtend: event.dtend,
        allDay: event.allDay,
        color: event.color,
      });
    }
    onClose();
  };

  const handleTimerAction = (action: 'start' | 'pause' | 'resume' | 'stop', onClose: () => void) => {
    const actions = {
      start: () => startTimer(eventId),
      pause: () => pauseTimer(eventId),
      resume: () => resumeTimer(eventId),
      stop: () => stopTimer(eventId),
    };
    actions[action]();
    onClose();
  };

  return {
    event,
    eventName,
    inputRef,
    handleColorChange,
    handlePreviewColor,
    handleNameChange,
    handleNameBlur,
    handleNameKeyDown,
    handleCopy,
    handleCut,
    handleDelete,
    handleDuplicate,
    handleTimerAction,
  };
}
