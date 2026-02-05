import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { MdContentCut,  MdContentCopy,  MdAddToPhotos,  MdPlayArrow,  MdPause,  MdStop  } from 'react-icons/md';
import { ColorPicker } from '@/components/common/ColorPicker';
import { DeleteIcon } from '@/components/common/DeleteIcon';
import { useMenuPosition } from './hooks/useMenuPosition';
import { useEventContextMenu } from './hooks/useEventContextMenu';

interface EventContextMenuProps {
  eventId: string;
  position: { x: number; y: number };
  currentColor?: string;
  timerState?: 'idle' | 'running' | 'paused';
  onClose: () => void;
}

export function EventContextMenu({ eventId, position, currentColor = 'blue', timerState = 'idle', onClose }: EventContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const adjustedPosition = useMenuPosition({ 
    initialPosition: position, 
    menuRef: menuRef as React.RefObject<HTMLDivElement>
  });
  
  const {
    eventName,
    inputRef,
    handleColorChange,
    handlePreviewColor,
    handleNameChange,
    handleNameBlur,
    handleNameKeyDown,
    handleDelete,
    handleDuplicate,
    handleTimerAction,
  } = useEventContextMenu(eventId, position);

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
            onClick={() => handleTimerAction('start', onClose)}
            className="w-full px-4 py-2 flex items-center gap-3 text-sm text-zinc-300 hover:bg-zinc-800"
          >
            <MdPlayArrow className="size-[18px]" />
            <span className="flex-1 text-left">Start Timer</span>
          </button>
        )}

        {timerState === 'running' && (
          <>
            <button
              onClick={() => handleTimerAction('pause', onClose)}
              className="w-full px-4 py-2 flex items-center gap-3 text-sm text-zinc-300 hover:bg-zinc-800"
            >
              <MdPause className="size-[18px]" />
              <span className="flex-1 text-left">Pause Timer</span>
            </button>
            <button
              onClick={() => handleTimerAction('stop', onClose)}
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
              onClick={() => handleTimerAction('resume', onClose)}
              className="w-full px-4 py-2 flex items-center gap-3 text-sm text-zinc-300 hover:bg-zinc-800"
            >
              <MdPlayArrow className="size-[18px]" />
              <span className="flex-1 text-left">Resume Timer</span>
            </button>
            <button
              onClick={() => handleTimerAction('stop', onClose)}
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
          onClick={() => handleDuplicate(onClose)}
          className="w-full px-4 py-2 flex items-center gap-3 text-sm text-zinc-300 hover:bg-zinc-800"
        >
          <MdAddToPhotos className="size-[18px]" />
          <span className="flex-1 text-left">Duplicate</span>
          <span className="text-zinc-500 text-xs">Ctrl D</span>
        </button>

        <div className="h-px bg-zinc-700 my-2" />

        <button
          onClick={() => handleDelete(onClose)}
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