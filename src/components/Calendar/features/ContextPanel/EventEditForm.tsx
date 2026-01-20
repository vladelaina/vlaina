import { useEffect, useRef, useCallback } from 'react';
import { startOfDay, endOfDay } from 'date-fns';
import { Clock, Sun } from 'lucide-react';
import { useCalendarStore, type NekoEvent } from '@/stores/useCalendarStore';
import { cn } from '@/lib/utils';
import { type ItemColor } from '@/lib/colors';
import { ColorPicker } from '@/components/common';
import { PremiumSlider } from '@/components/ui/premium-slider';
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
    localIcon,
    handleSummaryChange,
    handleKeyDown,
    handleColorHover,
    handleColorChange,
    handleIconChange,
    handlePreviewSize,
    handleIconSizeConfirm,
    isNewEvent,
  } = useEventForm(event);

  const inputRef = useRef<HTMLInputElement>(null);

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

  return (
    <div
      data-context-panel
      style={mode === 'floating' ? getFloatingStyle() : undefined}
      className={containerClass}
    >
      {/* Hero Header Section */}
      <HeroIconHeader
        id={event.uid}
        icon={localIcon}
        onIconChange={handleIconChange}
        onColorChange={handleColorChange}
        initialColor={currentColor as ItemColor}
        className="px-3 pb-0 max-w-none mx-0" // Compact layout
        compact={true}
        
        // Compact Icon Size
        iconSize={32} 
        minIconSize={20}
        maxIconSize={150}
        
        // Render Title with Color Indicator
        renderTitle={() => (
            <div className="flex items-center gap-2 w-full">
                <input
                    ref={inputRef}
                    type="text"
                    value={localSummary}
                    onChange={(e) => handleSummaryChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Event title"
                    className={cn(
                        "w-full bg-transparent text-sm font-semibold outline-none py-1",
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
      <div className={`px-3 pb-3 flex-1 overflow-y-auto neko-scrollbar`}>
        
        {/* Size Slider (between Header and Color) */}
        <div className="mb-4 px-1" data-prevent-picker-close="true">
            <PremiumSlider
                min={20}
                max={150}
                value={event.iconSize || 32}
                onChange={handlePreviewSize}
                onConfirm={handleIconSizeConfirm}
            />
        </div>

        {/* Color picker row */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider w-10">Color</span>
          <ColorPicker
            value={currentColor}
            onChange={handleColorChange}
            onHover={handleColorHover}
            sizeClass="w-4 h-4"
          />
        </div>

        {/* Divider */}
        <div className="h-px bg-zinc-100 dark:bg-zinc-800/50 my-2" />

        {/* All-day toggle */}
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 flex justify-center">
             <Sun className="size-3.5 text-zinc-400" />
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
              "flex items-center gap-2 text-xs transition-colors",
              event.allDay
                ? "text-blue-600 dark:text-blue-400"
                : "text-zinc-600 dark:text-zinc-300 hover:text-zinc-800 dark:hover:text-zinc-100"
            )}
          >
            <div className={cn(
              "w-7 h-3.5 rounded-full transition-colors relative",
              event.allDay
                ? "bg-blue-500"
                : "bg-zinc-300 dark:bg-zinc-600"
            )}>
              <div className={cn(
                "absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white shadow-sm transition-transform",
                event.allDay ? "translate-x-3.5" : "translate-x-0.5"
              )} />
            </div>
            <span>All Day</span>
          </button>
        </div>

        {/* Time */}
        {!event.allDay && (
          <div className="flex items-start gap-2 mb-3">
            <div className="w-8 flex justify-center mt-0.5">
                <Clock className="size-3.5 text-zinc-400" />
            </div>
            <div className="flex items-center text-xs">
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
              <span className="mx-1 text-zinc-400">→</span>
              <EditableTime
                date={endDate}
                use24Hour={use24Hour}
                onChange={(newEnd) => {
                  if (newEnd.getTime() > event.dtstart.getTime()) {
                    updateEvent(event.uid, { dtend: newEnd });
                  }
                }}
              />
              <span className="ml-2 text-zinc-400 text-[10px] bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded">{formatDuration()}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}