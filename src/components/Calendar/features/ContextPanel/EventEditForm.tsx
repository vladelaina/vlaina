import { useEffect, useRef, useCallback } from 'react';
import { startOfDay, endOfDay } from 'date-fns';
import { Clock, Folder, ChevronDown, X, Sun } from 'lucide-react';
import { useCalendarStore, type NekoEvent } from '@/stores/useCalendarStore';
import { cn } from '@/lib/utils';
import { ALL_COLORS, COLOR_HEX, type ItemColor } from '@/lib/colors';
import { ColorPicker } from '@/components/common';
import { useEventForm } from './hooks/useEventForm';
import { EditableTime } from './components/EditableTime';
import { useGlobalIconUpload } from '@/components/common/UniversalIconPicker/hooks/useGlobalIconUpload';
import { loadImageAsBlob } from '@/lib/assets/imageLoader';
import { HeroIconHeader } from '@/components/common/HeroIconHeader';

interface EventEditFormProps {
  event: NekoEvent;
  mode?: 'embedded' | 'floating';
  position?: { x: number; y: number };
}

export function EventEditForm({ event, mode = 'embedded', position }: EventEditFormProps) {
  const { updateEvent, use24Hour } = useCalendarStore();

  const {
    localSummary,
    handleSummaryChange,
    handleKeyDown,
    handleClose,
    handleColorHover,
    handleCalendarChange,
    handleColorChange,
    handleIconChange,
    showCalendarPicker,
    setShowCalendarPicker,
    currentCalendar,
    calendars,
    isNewEvent,
  } = useEventForm(event);

  const inputRef = useRef<HTMLInputElement>(null);
  const calendarPickerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Global Icon Upload
  const { customIcons, onUploadFile, onDeleteCustomIcon } = useGlobalIconUpload();
  const imageLoader = useCallback(async (src: string) => {
      if (!src.startsWith('img:')) return src;
      return await loadImageAsBlob(src.substring(4));
  }, []);

  // Auto-focus for new events
  useEffect(() => {
    if (isNewEvent.current && inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Close calendar picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (calendarPickerRef.current && !calendarPickerRef.current.contains(e.target as Node)) {
        setShowCalendarPicker(false);
      }
    };
    if (showCalendarPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showCalendarPicker]);

  // Time formatting
  const startDate = event.dtstart;
  const endDate = event.dtend;
  const durationMs = endDate.getTime() - startDate.getTime();
  const durationHours = Math.floor(durationMs / (1000 * 60 * 60));
  const durationMinutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

  const formatDuration = () => {
    if (durationHours > 0 && durationMinutes > 0) return `${durationHours}h ${durationMinutes}m`;
    if (durationHours > 0) return `${durationHours}h`;
    return `${durationMinutes}m`;
  };

  // Floating mode position calculation
  const getFloatingStyle = () => {
    if (mode !== 'floating' || !position) return {};
    const windowHeight = window.innerHeight;
    const windowWidth = window.innerWidth;
    const panelWidth = 280;
    const panelHeight = 400; // Increased height for new layout

    let top = position.y;
    let left = position.x + 20;

    if (left + panelWidth > windowWidth - 20) left = position.x - panelWidth - 20;
    if (top + panelHeight > windowHeight - 20) top = windowHeight - panelHeight - 20;
    if (top < 20) top = 20;

    return { top: `${top}px`, left: `${left}px` };
  };

  const containerClass = mode === 'floating'
    ? 'fixed z-[100] w-[320px] bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden flex flex-col'
    : 'h-full flex flex-col bg-white dark:bg-zinc-900';

  const currentColor = event.color || 'default';
  const colorValue = COLOR_HEX[currentColor as ItemColor];

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
      {/* Header with close button - Overlay on top right */}
      <div className="absolute top-2 right-2 z-50">
        <button
          onClick={handleClose}
          className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Hero Header Section */}
      <HeroIconHeader
        id={event.uid}
        icon={event.icon}
        onIconChange={handleIconChange}
        className="px-6 pb-0" // Adjust padding
        
        // Render Title with Color Indicator
        renderTitle={() => (
            <div className="flex items-center gap-3 w-full">
                <button
                    onClick={handleColorToggle}
                    className="flex-shrink-0 w-5 h-5 rounded-full border-2 transition-all hover:scale-110"
                    style={{ borderColor: colorValue, backgroundColor: colorValue }}
                    title="Change Color"
                />
                <input
                    ref={inputRef}
                    type="text"
                    value={localSummary}
                    onChange={(e) => handleSummaryChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Event title"
                    className={cn(
                        "flex-1 bg-transparent text-xl font-semibold outline-none py-1",
                        "text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-300 dark:placeholder:text-zinc-600"
                    )}
                />
            </div>
        )}

        customIcons={customIcons}
        onUploadFile={onUploadFile}
        onDeleteCustomIcon={onDeleteCustomIcon}
        imageLoader={imageLoader}
      />

      {/* Content Area */}
      <div className={`px-6 pb-6 flex-1 overflow-y-auto neko-scrollbar`}>
        
        {/* Color picker row */}
        <div className="flex items-center gap-2 mb-6">
          <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider w-12">Color</span>
          <ColorPicker
            value={currentColor}
            onChange={handleColorChange}
            onHover={handleColorHover}
          />
        </div>

        {/* Divider */}
        <div className="h-px bg-zinc-100 dark:bg-zinc-800/50 my-4" />

        {/* All-day toggle */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 flex justify-center">
             <Sun className="size-4 text-zinc-400" />
          </div>
          <button
            onClick={() => {
              if (event.allDay) {
                const dayStart = new Date(event.dtstart);
                dayStart.setHours(9, 0, 0, 0);
                const dayEnd = new Date(dayStart);
                dayEnd.setHours(10, 0, 0, 0);
                updateEvent(event.uid, {
                  allDay: false,
                  dtstart: dayStart,
                  dtend: dayEnd,
                });
              } else {
                updateEvent(event.uid, {
                  allDay: true,
                  dtstart: startOfDay(startDate),
                  dtend: endOfDay(startDate),
                });
              }
            }}
            className={cn(
              "flex items-center gap-2 text-sm transition-colors",
              event.allDay
                ? "text-blue-600 dark:text-blue-400"
                : "text-zinc-600 dark:text-zinc-300 hover:text-zinc-800 dark:hover:text-zinc-100"
            )}
          >
            <div className={cn(
              "w-8 h-4 rounded-full transition-colors relative",
              event.allDay
                ? "bg-blue-500"
                : "bg-zinc-300 dark:bg-zinc-600"
            )}>
              <div className={cn(
                "absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-transform",
                event.allDay ? "translate-x-4" : "translate-x-0.5"
              )} />
            </div>
            <span>All Day</span>
          </button>
        </div>

        {/* Time */}
        {!event.allDay && (
          <div className="flex items-start gap-3 mb-4">
            <div className="w-12 flex justify-center mt-0.5">
                <Clock className="size-4 text-zinc-400" />
            </div>
            <div className="flex items-center text-sm">
              <EditableTime
                date={startDate}
                use24Hour={use24Hour}
                onChange={(newStart) => {
                  const newEnd = new Date(newStart.getTime() + durationMs);
                  updateEvent(event.uid, {
                    dtstart: newStart,
                    dtend: newEnd
                  });
                }}
              />
              <span className="mx-2 text-zinc-400">→</span>
              <EditableTime
                date={endDate}
                use24Hour={use24Hour}
                onChange={(newEnd) => {
                  if (newEnd.getTime() > event.dtstart.getTime()) {
                    updateEvent(event.uid, { dtend: newEnd });
                  }
                }}
              />
              <span className="ml-3 text-zinc-400 text-xs bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">{formatDuration()}</span>
            </div>
          </div>
        )}

        {/* Calendar picker */}
        <div className="flex items-center gap-3 relative" ref={calendarPickerRef}>
          <div className="w-12 flex justify-center">
             <Folder className="size-4 text-zinc-400" />
          </div>
          <button
            onClick={() => setShowCalendarPicker(!showCalendarPicker)}
            className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300 hover:text-zinc-800 dark:hover:text-zinc-100 transition-colors bg-zinc-50 dark:bg-zinc-800 px-3 py-1.5 rounded-md"
          >
            <span>{currentCalendar?.name || 'Personal'}</span>
            <ChevronDown className={`size-3.5 text-zinc-400 transition-transform ${showCalendarPicker ? 'rotate-180' : ''}`} />
          </button>

          {showCalendarPicker && (
            <div className="absolute left-14 top-full mt-1 w-40 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg py-1 z-50">
              {calendars.map((calendar) => (
                <button
                  key={calendar.id}
                  onClick={() => handleCalendarChange(calendar.id)}
                  className={`w-full px-3 py-1.5 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors ${calendar.id === event.calendarId
                    ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                    : 'text-zinc-600 dark:text-zinc-300'
                    }`}
                >
                  {calendar.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}