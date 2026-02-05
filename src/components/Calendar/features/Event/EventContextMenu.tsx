import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MdContentCut,  MdContentCopy,  MdAddToPhotos,  MdPlayArrow,  MdPause,  MdStop  } from 'react-icons/md';
import { useCalendarStore } from '@/stores/useCalendarStore';
import { ColorPicker } from '@/components/common/ColorPicker';
import { DeleteIcon } from '@/components/common/DeleteIcon';
import { useIconPreview } from '@/components/common/UniversalIconPicker/useIconPreview';
import type { ItemColor } from '@/lib/colors';

interface EventContextMenuProps {
  eventId: string;
  position: { x: number; y: number };
  currentColor?: string;
  timerState?: 'idle' | 'running' | 'paused';
  onClose: () => void;
  onOpenPanel?: () => void;
}

export function EventContextMenu({ eventId, position, currentColor = 'blue', timerState = 'idle', onClose, onOpenPanel }: EventContextMenuProps) {
  const { updateEvent, deleteEvent, events, addEvent, startTimer, pauseTimer, resumeTimer, stopTimer, setEditingEventId } = useCalendarStore();
  const [eventName, setEventName] = useState('');
  const [adjustedPosition, setAdjustedPosition] = useState(position);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  
  const { handlePreviewColor } = useIconPreview(eventId);
  
  const event = events.find(e => e.uid === eventId);

  useEffect(() => {
    if (event) {
      setEventName(event.summary || '');
    }
  }, [event]);

  useEffect(() => {
    setEditingEventId(eventId, position);
    onOpenPanel?.();
  }, [eventId, position, setEditingEventId, onOpenPanel]);

  useEffect(() => {
    if (menuRef.current) {
      const menuRect = menuRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      
      let newX = position.x;
      let newY = position.y;
      
      if (position.y + menuRect.height > viewportHeight) {
        newY = viewportHeight - menuRect.height - 10;
      }
      
      if (position.x + menuRect.width > viewportWidth) {
        newX = viewportWidth - menuRect.width - 10;
      }
      
      newY = Math.max(10, newY);
      newX = Math.max(10, newX);
      
      setAdjustedPosition({ x: newX, y: newY });
    }
  }, [position]);

  const handleColorChange = (color: ItemColor) => {
    updateEvent(eventId, { color });
    handlePreviewColor(null);
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEventName(e.target.value);
  };

  const handleNameBlur = () => {
    if (eventName.trim() !== event?.summary) {
      updateEvent(eventId, { summary: eventName.trim() || 'Untitled' });
    }
  };

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      updateEvent(eventId, { summary: eventName.trim() || 'Untitled' });
      inputRef.current?.blur();
    } else if (e.key === 'Escape') {
      setEventName(event?.summary || '');
      inputRef.current?.blur();
    }
  };

  const handleDelete = () => {
    deleteEvent(eventId);
    onClose();
  };

  const handleDuplicate = () => {
    const event = events.find(e => e.uid === eventId);
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

  const handleStartTimer = () => {
    startTimer(eventId);
    onClose();
  };

  const handlePauseTimer = () => {
    pauseTimer(eventId);
    onClose();
  };

  const handleResumeTimer = () => {
    resumeTimer(eventId);
    onClose();
  };

  const handleStopTimer = () => {
    stopTimer(eventId);
    onClose();
  };

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        data-event-context-menu
        className="fixed inset-0 z-[99998]"
        onClick={onClose}
        onContextMenu={(e) => { e.preventDefault(); onClose(); }}
      />

      {/* Menu */}
      <div
        ref={menuRef}
        data-event-context-menu
        className="fixed z-[99999] w-56 bg-zinc-900 rounded-xl shadow-2xl py-2 overflow-hidden"
        style={{ top: adjustedPosition.y, left: adjustedPosition.x }}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Color Picker */}
        <div className="px-4 py-2">
          <ColorPicker
            value={currentColor}
            onChange={handleColorChange}
            onHover={handlePreviewColor}
          />
        </div>

        {/* Name Input */}
        <div className="px-4 py-2">
          <input
            ref={inputRef}
            type="text"
            value={eventName}
            onChange={handleNameChange}
            onBlur={handleNameBlur}
            onKeyDown={handleNameKeyDown}
            placeholder="Event name"
            className="w-full px-2 py-1.5 text-sm bg-zinc-800 border border-zinc-700 rounded text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-600"
            onClick={(e) => e.stopPropagation()}
          />
        </div>

        <div className="h-px bg-zinc-700 my-2" />

        {/* Timer Actions */}
        {timerState === 'idle' && (
          <button
            onClick={handleStartTimer}
            className="w-full px-4 py-2 flex items-center gap-3 text-sm text-zinc-300 hover:bg-zinc-800"
          >
            <MdPlayArrow className="size-[18px]" />
            <span className="flex-1 text-left">Start Timer</span>
          </button>
        )}

        {timerState === 'running' && (
          <>
            <button
              onClick={handlePauseTimer}
              className="w-full px-4 py-2 flex items-center gap-3 text-sm text-zinc-300 hover:bg-zinc-800"
            >
              <MdPause className="size-[18px]" />
              <span className="flex-1 text-left">Pause Timer</span>
            </button>
            <button
              onClick={handleStopTimer}
              className="w-full px-4 py-2 flex items-center gap-3 text-sm text-zinc-300 hover:bg-zinc-800"
            >
              <MdStop className="size-[18px]" />
              <span className="flex-1 text-left">Stop Timer</span>
            </button>
          </>
        )}

        {timerState === 'paused' && (
          <>
            <button
              onClick={handleResumeTimer}
              className="w-full px-4 py-2 flex items-center gap-3 text-sm text-zinc-300 hover:bg-zinc-800"
            >
              <MdPlayArrow className="size-[18px]" />
              <span className="flex-1 text-left">Resume Timer</span>
            </button>
            <button
              onClick={handleStopTimer}
              className="w-full px-4 py-2 flex items-center gap-3 text-sm text-zinc-300 hover:bg-zinc-800"
            >
              <MdStop className="size-[18px]" />
              <span className="flex-1 text-left">Stop Timer</span>
            </button>
          </>
        )}

        <div className="h-px bg-zinc-700 my-2" />

        {/* Actions */}
        <button className="w-full px-4 py-2 flex items-center gap-3 text-sm text-zinc-300 hover:bg-zinc-800">
          <MdContentCut className="size-[18px]" />
          <span className="flex-1 text-left">Cut</span>
          <span className="text-zinc-500 text-xs">Ctrl X</span>
        </button>

        <button className="w-full px-4 py-2 flex items-center gap-3 text-sm text-zinc-300 hover:bg-zinc-800">
          <MdContentCopy className="size-[18px]" />
          <span className="flex-1 text-left">Copy</span>
          <span className="text-zinc-500 text-xs">Ctrl C</span>
        </button>

        <button
          onClick={handleDuplicate}
          className="w-full px-4 py-2 flex items-center gap-3 text-sm text-zinc-300 hover:bg-zinc-800"
        >
          <MdAddToPhotos className="size-[18px]" />
          <span className="flex-1 text-left">Duplicate</span>
          <span className="text-zinc-500 text-xs">Ctrl D</span>
        </button>

        <div className="h-px bg-zinc-700 my-2" />

        <button
          onClick={handleDelete}
          className="w-full px-4 py-2 flex items-center gap-3 text-sm text-red-400 hover:bg-zinc-800"
        >
          <DeleteIcon className="size-[18px]" />
          <span className="flex-1 text-left">Delete</span>
          <span className="text-zinc-500 text-xs">Del</span>
        </button>
      </div>
    </>,
    document.body
  );
}