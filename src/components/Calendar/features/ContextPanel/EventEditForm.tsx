/**
 * EventEditForm - Event edit form
 * 
 * Supports two modes:
 * 1. Embedded (in the right panel)
 * 2. Floating (when the right panel is hidden)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { format, setHours, setMinutes, startOfDay, endOfDay } from 'date-fns';
import { IconClock, IconFolder, IconChevronDown, IconX, IconSun } from '@tabler/icons-react';
import { useCalendarStore, type CalendarEvent } from '@/stores/useCalendarStore';
import { useUIStore } from '@/stores/uiSlice';
import { cn } from '@/lib/utils';
import { ALL_COLORS, COLOR_HEX, type ItemColor } from '@/lib/colors';
import { parseClockTime } from '@/lib/time';
import { IconSelector, TaskIcon, ColorPicker } from '@/components/common';

// ============ Editable Time Component ============

interface EditableTimeProps {
  date: Date;
  onChange: (newDate: Date) => void;
  use24Hour?: boolean;
}

function EditableTime({ date, onChange, use24Hour = true }: EditableTimeProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  
  const displayTime = use24Hour 
    ? format(date, 'H:mm')
    : format(date, 'h:mm a').toUpperCase();
  
  // 解析预览：显示用户输入被解析成什么，无效时显示当前时间
  const parsedPreview = (() => {
    const parsed = parseClockTime(inputValue);
    const previewDate = parsed 
      ? setMinutes(setHours(new Date(), parsed.hours), parsed.minutes)
      : date;
    const text = use24Hour 
      ? format(previewDate, 'H:mm')
      : format(previewDate, 'h:mm a').toUpperCase();
    return { valid: !!parsed, text };
  })();
  
  const handleStartEdit = () => {
    // 根据用户设置显示对应格式，方便用户编辑
    setInputValue(use24Hour ? format(date, 'H:mm') : format(date, 'h:mma').toLowerCase());
    setIsEditing(true);
  };
  
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);
  
  // 实时预览：输入时立即更新事件
  const handleInputChange = useCallback((value: string) => {
    setInputValue(value);
    const parsed = parseClockTime(value);
    if (parsed) {
      const newDate = setMinutes(setHours(date, parsed.hours), parsed.minutes);
      onChange(newDate);
    }
  }, [date, onChange]);
  
  const handleBlur = useCallback(() => {
    setIsEditing(false);
  }, []);
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setIsEditing(false);
    } else if (e.key === 'Escape') {
      setIsEditing(false);
    }
  };
  
  if (isEditing) {
    return (
      <div className="relative">
        {/* 解析预览 */}
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 px-1.5 py-0.5 text-[10px] rounded whitespace-nowrap bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300">
          {parsedPreview.text}
        </div>
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => handleInputChange(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="w-16 px-1 py-0.5 text-sm bg-zinc-100 dark:bg-zinc-800 rounded outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-500 text-center"
        />
      </div>
    );
  }
  
  return (
    <button
      onClick={handleStartEdit}
      className="px-1 py-0.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors"
    >
      {displayTime}
    </button>
  );
}

// ============ Types ============

interface EventEditFormProps {
  event: CalendarEvent;
  mode?: 'embedded' | 'floating';
  position?: { x: number; y: number };
}

// ============ Component ============

export function EventEditForm({ event, mode = 'embedded', position }: EventEditFormProps) {
  const { updateEvent, updateTaskIcon, closeEditingEvent, groups, use24Hour, deleteEvent } = useCalendarStore();
  const { setPreviewIcon, setPreviewColor } = useUIStore();
  const [content, setContent] = useState(event.content || '');
  const [showGroupPicker, setShowGroupPicker] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const groupPickerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isNewEvent = useRef(!(event.content || '').trim());

  // Handle close button click - delete empty events
  const handleClose = useCallback(() => {
    if (!event.content.trim()) {
      deleteEvent(event.id);
    }
    // 清除全局预览状态
    setPreviewIcon(null, null);
    setPreviewColor(null, null);
    closeEditingEvent();
  }, [event.id, event.content, deleteEvent, closeEditingEvent, setPreviewIcon, setPreviewColor]);

  // 图标悬停预览回调 - 更新全局状态让 EventBlock 显示预览
  const handleIconHover = useCallback((icon: string | undefined | null) => {
    if (icon === null) {
      // 鼠标离开，清除预览
      setPreviewIcon(null, null);
    } else {
      // 鼠标悬停，设置预览
      setPreviewIcon(event.id, icon);
    }
  }, [event.id, setPreviewIcon]);

  // 颜色悬停预览回调 - 更新全局状态让 EventBlock 显示预览
  const handleColorHover = useCallback((color: ItemColor | null) => {
    if (color === null) {
      // 鼠标离开，清除预览
      setPreviewColor(null, null);
    } else {
      // 鼠标悬停，设置预览
      setPreviewColor(event.id, color);
    }
  }, [event.id, setPreviewColor]);

  const currentGroup = groups.find(g => g.id === event.groupId) || groups[0];

  // Sync content
  useEffect(() => {
    setContent(event.content || '');
  }, [event.content]);

  // Auto-focus for new events
  useEffect(() => {
    if (isNewEvent.current && inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Close group picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (groupPickerRef.current && !groupPickerRef.current.contains(e.target as Node)) {
        setShowGroupPicker(false);
      }
    };
    if (showGroupPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showGroupPicker]);

  // ============ Event Handlers ============

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    updateEvent(event.id, { content: newContent });
  };

  const handleColorChange = (color: ItemColor) => {
    updateEvent(event.id, { color });
  };

  const handleGroupChange = (groupId: string) => {
    updateEvent(event.id, { groupId });
    setShowGroupPicker(false);
  };

  // ============ Time Formatting ============

  const startDate = new Date(event.startDate);
  const endDate = new Date(event.endDate);
  const durationMs = endDate.getTime() - startDate.getTime();
  const durationHours = Math.floor(durationMs / (1000 * 60 * 60));
  const durationMinutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

  const formatDuration = () => {
    if (durationHours > 0 && durationMinutes > 0) return `${durationHours}h ${durationMinutes}m`;
    if (durationHours > 0) return `${durationHours}h`;
    return `${durationMinutes}m`;
  };

  // ============ Floating Mode Position Calculation ============

  const getFloatingStyle = () => {
    if (mode !== 'floating' || !position) {
      return {};
    }

    const windowHeight = window.innerHeight;
    const windowWidth = window.innerWidth;
    const panelWidth = 280;
    const panelHeight = 240;

    let top = position.y;
    let left = position.x + 20;

    if (left + panelWidth > windowWidth - 20) {
      left = position.x - panelWidth - 20;
    }

    if (top + panelHeight > windowHeight - 20) {
      top = windowHeight - panelHeight - 20;
    }

    if (top < 20) {
      top = 20;
    }

    return { top: `${top}px`, left: `${left}px` };
  };

  // ============ Render ============

  const containerClass = mode === 'floating'
    ? 'fixed z-[100] w-[280px] bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden'
    : 'h-full flex flex-col bg-white dark:bg-zinc-900';

  const currentColor = event.color || 'default';
  const colorValue = COLOR_HEX[currentColor];

  // Toggle to next color when clicking the checkbox
  const handleColorToggle = () => {
    const currentIndex = ALL_COLORS.indexOf(currentColor);
    const nextIndex = (currentIndex + 1) % ALL_COLORS.length;
    handleColorChange(ALL_COLORS[nextIndex]);
  };

  return (
    <div
      ref={containerRef}
      data-context-panel
      style={mode === 'floating' ? getFloatingStyle() : undefined}
      className={containerClass}
    >
      {/* Header with close button */}
      <div className={`flex items-center justify-end p-2 ${mode === 'floating' ? 'p-2' : ''}`}>
        <button
          onClick={handleClose}
          className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors"
        >
          <IconX className="size-4 text-zinc-400" />
        </button>
      </div>

      {/* Task-like content area */}
      <div className={`px-4 pb-4 ${mode === 'floating' ? 'px-3 pb-3' : ''}`}>
        {/* Main row: Color checkbox + Icon preview + Content input */}
        <div className="flex items-start gap-2">
          {/* Color checkbox - like todo item */}
          <button
            onClick={handleColorToggle}
            className="mt-2 flex-shrink-0 w-4 h-4 rounded-sm border-2 transition-all hover:scale-110"
            style={{ borderColor: colorValue }}
            title="Click to change color"
          />
          
          {/* Icon preview - same position as todo item, using event color */}
          <div className="mt-1.5">
            <TaskIcon 
              itemId={event.id}
              icon={event.icon}
              color={colorValue}
              sizeClass="size-4"
            />
          </div>
          
          {/* Content input */}
          <input
            ref={inputRef}
            type="text"
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                closeEditingEvent();
              }
            }}
            placeholder="Add content"
            className={cn(
              "flex-1 bg-transparent text-sm outline-none py-1.5",
              "text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400"
            )}
          />
        </div>

        {/* Color picker row */}
        <div className="flex items-center gap-1.5 mt-3 ml-7">
          <ColorPicker
            value={currentColor}
            onChange={handleColorChange}
            onHover={handleColorHover}
          />
        </div>

        {/* Icon picker row - 让图标网格自适应宽度 */}
        <div className="mt-3 ml-7">
          <IconSelector 
            value={event.icon} 
            onChange={(icon) => updateTaskIcon(event.id, icon)}
            onHover={handleIconHover}
          />
        </div>

        {/* Divider */}
        <div className="h-px bg-zinc-200 dark:bg-zinc-800 my-4" />

        {/* All-day toggle */}
        <div className="flex items-center gap-3">
          <IconSun className="size-4 text-zinc-400" />
          <button
            onClick={() => {
              if (event.isAllDay) {
                // Convert to timed event: set to 9:00-10:00 on the same day
                const dayStart = new Date(event.startDate);
                dayStart.setHours(9, 0, 0, 0);
                const dayEnd = new Date(dayStart);
                dayEnd.setHours(10, 0, 0, 0);
                updateEvent(event.id, {
                  isAllDay: false,
                  startDate: dayStart.getTime(),
                  endDate: dayEnd.getTime(),
                });
              } else {
                // Convert to all-day event
                updateEvent(event.id, {
                  isAllDay: true,
                  startDate: startOfDay(startDate).getTime(),
                  endDate: endOfDay(startDate).getTime(),
                });
              }
            }}
            className={cn(
              "flex items-center gap-2 text-sm transition-colors",
              event.isAllDay
                ? "text-blue-600 dark:text-blue-400"
                : "text-zinc-600 dark:text-zinc-300 hover:text-zinc-800 dark:hover:text-zinc-100"
            )}
          >
            <div className={cn(
              "w-8 h-4 rounded-full transition-colors relative",
              event.isAllDay
                ? "bg-blue-500"
                : "bg-zinc-300 dark:bg-zinc-600"
            )}>
              <div className={cn(
                "absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-transform",
                event.isAllDay ? "translate-x-4" : "translate-x-0.5"
              )} />
            </div>
            <span>全天</span>
          </button>
        </div>

        {/* Time (only show for non-all-day events) */}
        {!event.isAllDay && (
          <div className="flex items-start gap-3 mt-3">
            <IconClock className="size-4 text-zinc-400 mt-0.5" />
            <div className="flex items-center text-sm">
              <EditableTime
                date={startDate}
                use24Hour={use24Hour}
                onChange={(newStart) => {
                  const newEnd = new Date(newStart.getTime() + durationMs);
                  updateEvent(event.id, { 
                    startDate: newStart.getTime(),
                    endDate: newEnd.getTime()
                  });
                }}
              />
              <span className="mx-1 text-zinc-400">→</span>
              <EditableTime
                date={endDate}
                use24Hour={use24Hour}
                onChange={(newEnd) => {
                  if (newEnd.getTime() > event.startDate) {
                    updateEvent(event.id, { endDate: newEnd.getTime() });
                  }
                }}
              />
              <span className="ml-2 text-zinc-400 text-xs">{formatDuration()}</span>
            </div>
          </div>
        )}

        {/* Group picker */}
        <div className="flex items-center gap-3 mt-3 relative" ref={groupPickerRef}>
          <IconFolder className="size-4 text-zinc-400" />
          <button
            onClick={() => setShowGroupPicker(!showGroupPicker)}
            className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300 hover:text-zinc-800 dark:hover:text-zinc-100 transition-colors"
          >
            <span>{currentGroup?.name || 'Inbox'}</span>
            <IconChevronDown className={`size-3.5 text-zinc-400 transition-transform ${showGroupPicker ? 'rotate-180' : ''}`} />
          </button>

          {showGroupPicker && (
            <div className="absolute left-7 top-full mt-1 w-40 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg py-1 z-50">
              {groups.map((group) => (
                <button
                  key={group.id}
                  onClick={() => handleGroupChange(group.id)}
                  className={`w-full px-3 py-1.5 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors ${
                    group.id === event.groupId
                      ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                      : 'text-zinc-600 dark:text-zinc-300'
                  }`}
                >
                  {group.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
