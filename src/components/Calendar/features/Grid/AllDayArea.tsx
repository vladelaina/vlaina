/**
 * AllDayArea - All-day events display area
 * 
 * Displays all-day events at the top of the calendar grid.
 * Supports drag-to-create and drag-to-convert interactions.
 */

import { useMemo, useCallback, useState, useRef } from 'react';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';

import { useCalendarStore } from '@/stores/useCalendarStore';
import type { NekoEvent } from '@/lib/ics/types';
import { EventContextMenu } from '../Event/EventContextMenu';
import { getAllDayInlineStyles } from '@/lib/colors';
import {
  calculateAllDayLayout,
  ALL_DAY_CONSTANTS,
} from '../../utils/allDayLayout';

const { EVENT_HEIGHT, EVENT_GAP, MIN_AREA_HEIGHT, COLLAPSED_HEIGHT } = ALL_DAY_CONSTANTS;

interface AllDayAreaProps {
  days: Date[];
  allDayEvents: NekoEvent[];
  gutterWidth: number;
  isDropTarget?: boolean;
  onCreateAllDay?: (startDay: Date, endDay: Date) => void;
  onEventDragStart?: (eventId: string, clientY: number) => void;
  onToggle?: (id: string) => void;
}


export function AllDayArea({
  days,
  allDayEvents,
  gutterWidth,
  isDropTarget = false,
  onCreateAllDay,
  onEventDragStart,
  onToggle,
}: AllDayAreaProps) {
  const { setEditingEventId, editingEventId } = useCalendarStore();

  const areaRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragEnd, setDragEnd] = useState<number | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [eventDragStarted, setEventDragStarted] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ eventId: string; x: number; y: number } | null>(null);

  // Calculate layout
  const { layoutedEvents, totalRows } = useMemo(
    () => calculateAllDayLayout(allDayEvents, days),
    [allDayEvents, days]
  );

  // Collapse when 2+ visible events, show directly when 0-1 event
  // Use layoutedEvents.length (events in current view) instead of allDayEvents.length
  const shouldCollapse = layoutedEvents.length >= 2;
  const showEvents = !shouldCollapse || isExpanded;

  // Calculate area height
  const areaHeight = useMemo(() => {
    if (layoutedEvents.length === 0) return MIN_AREA_HEIGHT;
    if (!showEvents) return COLLAPSED_HEIGHT; // Collapsed state
    // Expanded or single event
    return Math.max(
      MIN_AREA_HEIGHT,
      totalRows * (EVENT_HEIGHT + EVENT_GAP) + EVENT_GAP
    );
  }, [layoutedEvents.length, showEvents, totalRows]);

  // Get day index from mouse position
  const getDayIndexFromMouse = useCallback((clientX: number) => {
    if (!areaRef.current) return null;
    const rect = areaRef.current.getBoundingClientRect();
    const relativeX = clientX - rect.left - gutterWidth;
    const dayWidth = (rect.width - gutterWidth) / days.length;
    const dayIndex = Math.floor(relativeX / dayWidth);
    return dayIndex >= 0 && dayIndex < days.length ? dayIndex : null;
  }, [days.length, gutterWidth]);

  // Drag to create handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('.all-day-event')) return;
    // Don't create new event if context menu is open
    if (contextMenu) {
      setContextMenu(null);
      return;
    }

    const dayIndex = getDayIndexFromMouse(e.clientX);
    if (dayIndex === null) return;

    setIsDragging(true);
    setDragStart(dayIndex);
    setDragEnd(dayIndex);
  }, [getDayIndexFromMouse, contextMenu]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    const dayIndex = getDayIndexFromMouse(e.clientX);
    if (dayIndex !== null) {
      setDragEnd(dayIndex);
    }
  }, [isDragging, getDayIndexFromMouse]);

  const handleMouseUp = useCallback(() => {
    if (!isDragging || dragStart === null || dragEnd === null) {
      setIsDragging(false);
      return;
    }

    const startIdx = Math.min(dragStart, dragEnd);
    const endIdx = Math.max(dragStart, dragEnd);

    onCreateAllDay?.(days[startIdx], days[endIdx]);

    setIsDragging(false);
    setDragStart(null);
    setDragEnd(null);
  }, [isDragging, dragStart, dragEnd, days, onCreateAllDay]);

  const handleMouseLeave = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      setDragStart(null);
      setDragEnd(null);
    }
  }, [isDragging]);

  // Event click handler
  const handleEventClick = useCallback((e: React.MouseEvent, eventId: string) => {
    e.stopPropagation();
    // Don't open editor if we just finished dragging
    if (eventDragStarted) {
      setEventDragStarted(false);
      return;
    }
    setEditingEventId(eventId, { x: e.clientX, y: e.clientY });
  }, [setEditingEventId, eventDragStarted]);

  // Event drag handler - for dragging all-day events out to time grid
  const handleEventMouseDown = useCallback((e: React.MouseEvent, eventId: string) => {
    if (e.button !== 0) return;
    // Don't start drag if clicking on checkbox
    if ((e.target as HTMLElement).closest('button')) return;

    e.stopPropagation();
    setEventDragStarted(true);
    onEventDragStart?.(eventId, e.clientY);
  }, [onEventDragStart]);

  // Toggle completion
  const handleToggle = useCallback((e: React.MouseEvent, eventId: string) => {
    e.stopPropagation();
    onToggle?.(eventId);
  }, [onToggle]);

  // Right-click context menu
  const handleContextMenu = useCallback((e: React.MouseEvent, eventId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ eventId, x: e.clientX, y: e.clientY });
  }, []);

  // Render ghost selection
  const renderGhost = () => {
    if (!isDragging || dragStart === null || dragEnd === null) return null;

    const startIdx = Math.min(dragStart, dragEnd);
    const endIdx = Math.max(dragStart, dragEnd);
    const dayWidth = 100 / days.length;

    return (
      <div
        className="absolute z-20 bg-zinc-400/20 border-2 border-zinc-400 border-dashed rounded-md pointer-events-none"
        style={{
          left: `${startIdx * dayWidth}%`,
          width: `${(endIdx - startIdx + 1) * dayWidth}%`,
          top: EVENT_GAP,
          height: EVENT_HEIGHT,
        }}
      />
    );
  };

  return (
    <div
      ref={areaRef}
      className={`
        relative flex border-b transition-all duration-200
        ${isDropTarget ? 'bg-blue-50/50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700' : 'border-zinc-200 dark:border-zinc-800'}
      `}
      style={{ minHeight: areaHeight }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      {/* Gutter - entire area clickable for expand/collapse */}
      <div
        style={{ width: gutterWidth }}
        className={`
          flex-shrink-0 flex items-center justify-end pr-2
          ${shouldCollapse ? 'hover:bg-zinc-100/50 dark:hover:bg-zinc-800/30 transition-colors' : ''}
        `}
        onClick={shouldCollapse ? () => setIsExpanded(!isExpanded) : undefined}
      >
        {layoutedEvents.length > 0 && (
          shouldCollapse ? (
            // Chevron + count when collapsed
            <div className="flex items-center gap-0.5 text-[10px] text-zinc-400 dark:text-zinc-500">
              {isExpanded ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
              <span className="font-medium">{layoutedEvents.length}</span>
            </div>
          ) : (
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium">
              All Day
            </span>
          )
        )}
      </div>

      {/* Events area */}
      <div className="flex-1 relative">
        {/* Column dividers */}
        <div
          className="absolute inset-0 grid pointer-events-none"
          style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}
        >
          {days.map((_, i) => (
            <div
              key={i}
              className="border-r border-zinc-100 dark:border-zinc-800/50 last:border-r-0"
            />
          ))}
        </div>

        {/* Events - only show when expanded or single event */}
        {showEvents && layoutedEvents.map(({ event, row, startCol, endCol }) => {
          const dayWidth = 100 / days.length;
          const colorStyles = getAllDayInlineStyles(event.color);
          const isDark = typeof window !== 'undefined' && document.documentElement.classList.contains('dark');
          const bgColor = isDark ? colorStyles.bgDark : colorStyles.bg;
          const textColor = isDark ? colorStyles.textDark : colorStyles.text;
          const isActive = editingEventId === event.uid;
          const isMultiDay = endCol > startCol;

          return (
            <div
              key={event.uid}
              className={`
                  all-day-event absolute flex items-center gap-1 px-1.5 rounded
                  transition-all duration-150 select-none
                  ${isActive ? 'ring-2 ring-blue-400 dark:ring-blue-500 shadow-md z-30' : 'hover:shadow-sm z-10'}
                  ${event.completed ? 'opacity-60' : ''}
                `}
              style={{
                left: `calc(${startCol * dayWidth}% + 2px)`,
                width: `calc(${(endCol - startCol + 1) * dayWidth}% - 4px)`,
                top: row * (EVENT_HEIGHT + EVENT_GAP) + EVENT_GAP,
                height: EVENT_HEIGHT,
                backgroundColor: bgColor,
                color: textColor,
              }}
              onClick={(e) => handleEventClick(e, event.uid)}
              onMouseDown={(e) => handleEventMouseDown(e, event.uid)}
              onContextMenu={(e) => handleContextMenu(e, event.uid)}
            >
              {/* Checkbox */}
              <button
                onClick={(e) => handleToggle(e, event.uid)}
                className={`
                    flex-shrink-0 w-3 h-3 rounded-sm border flex items-center justify-center
                    ${event.completed
                    ? 'bg-zinc-400 border-zinc-400 dark:bg-zinc-500 dark:border-zinc-500'
                    : 'border-current opacity-50 hover:opacity-80'
                  }
                  `}
              >
                {event.completed && <Check className="w-2 h-2 text-white" strokeWidth={3} />}
              </button>

              {/* Content */}
              <span className={`
                  flex-1 text-[11px] font-medium truncate
                  ${event.completed ? 'line-through' : ''}
                `}>
                {event.summary || 'Untitled'}
              </span>

              {/* Multi-day indicator */}
              {isMultiDay && startCol === 0 && (
                <span className="text-[9px] opacity-60">◀</span>
              )}
              {isMultiDay && endCol === days.length - 1 && (
                <span className="text-[9px] opacity-60">▶</span>
              )}
            </div>
          );
        })}

        {/* Ghost selection */}
        {renderGhost()}

        {/* Drop target hint */}
        {isDropTarget && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-xs text-blue-500 dark:text-blue-400 font-medium bg-white/80 dark:bg-zinc-900/80 px-2 py-1 rounded">
              Drop to set as all-day event
            </span>
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <EventContextMenu
          eventId={contextMenu.eventId}
          position={{ x: contextMenu.x, y: contextMenu.y }}
          currentColor={allDayEvents.find(e => e.uid === contextMenu.eventId)?.color}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
