import { useState } from 'react';
import { createPortal } from 'react-dom';
import { MdContentCut, MdContentCopy, MdAddToPhotos, MdDelete, MdCheck, MdPlayArrow, MdPause, MdStop } from 'react-icons/md';
import { useCalendarStore } from '@/stores/useCalendarStore';
import { CONTEXT_MENU_COLORS, type ItemColor } from '@/lib/colors';
import { IconSelector } from '@/components/common';

interface EventContextMenuProps {
  eventId: string;
  position: { x: number; y: number };
  currentColor?: string;
  currentIcon?: string;
  timerState?: 'idle' | 'running' | 'paused';
  onClose: () => void;
}

export function EventContextMenu({ eventId, position, currentColor = 'blue', currentIcon, timerState = 'idle', onClose }: EventContextMenuProps) {
  const { updateEvent, updateEventIcon, deleteEvent, events, addEvent, startTimer, pauseTimer, resumeTimer, stopTimer } = useCalendarStore();
  const [selectedIcon, setSelectedIcon] = useState(currentIcon);

  const handleColorChange = (color: ItemColor) => {
    updateEvent(eventId, { color });
    onClose();
  };

  const handleIconChange = (icon: string | undefined) => {
    setSelectedIcon(icon);
    updateEventIcon(eventId, icon);
    onClose();
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
        data-event-context-menu
        className="fixed z-[99999] w-56 bg-zinc-900 rounded-xl shadow-2xl py-2 overflow-hidden"
        style={{ top: position.y, left: position.x }}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Color Picker */}
        <div className="px-4 py-2 flex gap-2">
          {CONTEXT_MENU_COLORS.map((color) => (
            <button
              key={color.name}
              onClick={() => handleColorChange(color.name)}
              className="w-6 h-6 rounded-md flex items-center justify-center hover:scale-110 transition-transform"
              style={{ backgroundColor: color.hex }}
            >
              {currentColor === color.name && <MdCheck className="size-[18px] text-white" />}
            </button>
          ))}
        </div>

        {/* Icon Selector */}
        <IconSelector value={selectedIcon} onChange={handleIconChange} closeOnSelect={false} />

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
          <MdDelete className="size-[18px]" />
          <span className="flex-1 text-left">Delete</span>
          <span className="text-zinc-500 text-xs">Del</span>
        </button>
      </div>
    </>,
    document.body
  );
}
