/**
 * BaseTimeGrid - Base time grid component
 * 
 * Unifies common logic for DayGrid and TimeGrid
 * Configures different behaviors via props
 */

import { useRef, useEffect, useState, useMemo } from 'react';
import { getHours, getMinutes } from 'date-fns';

import { useCalendarStore } from '@/stores/useCalendarStore';
import { useCalendarEvents } from '../../hooks/useCalendarEvents';
import { AllDayArea } from './AllDayArea';
import {
  CALENDAR_CONSTANTS,
  hourToDisplayPosition,
  DEFAULT_DAY_START_MINUTES,
} from '../../utils/timeUtils';

import { useTimeGridDrag } from './hooks/useTimeGridDrag';
import { TimeColumn } from './components/TimeColumn';
import { GridLines } from './components/GridLines';
import { CurrentTimeLine } from './components/CurrentTimeLine';
import { EventsLayer } from './components/EventsLayer';
import { SunLinesLayer } from './components/SunLinesLayer';
import { TimezoneHeader } from './components/TimezoneHeader';

const GUTTER_WIDTH = CALENDAR_CONSTANTS.GUTTER_WIDTH as number;

interface BaseTimeGridProps {
  days: Date[];
  onToggle?: (id: string) => void;
}

export function BaseTimeGrid({ days, onToggle }: BaseTimeGridProps) {
  const {
    hourHeight, use24Hour, dayStartTime,
  } = useCalendarStore();
  const displayItems = useCalendarEvents();

  const [now, setNow] = useState(new Date());
  const scrollRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const allDayAreaRef = useRef<HTMLDivElement>(null);

  const columnCount = days.length;
  // Use configured day start time or default
  const dayStartMinutes = dayStartTime ?? DEFAULT_DAY_START_MINUTES;

  // Separate all-day and timed events
  const { allDayEvents, timedEvents } = useMemo(() => {
    const allDay: typeof displayItems = [];
    const timed: typeof displayItems = [];

    for (const item of displayItems) {
      if (item.allDay) {
        allDay.push(item);
      } else {
        timed.push(item);
      }
    }

    return { allDayEvents: allDay, timedEvents: timed };
  }, [displayItems]);

  // Hook handles drag, drop, creating, resizing, auto-scroll
  const {
    isDragging,
    dragStart,
    dragEnd,
    dragId,
    isAllDayDropTarget,
    dragTimeIndicator,
    hoverTimeIndicator,
    handleCanvasMouseDown,
    handleEventDragStart,
    handleAllDayEventDragStart,
    handleCreateAllDay,
    handleEventHover,
  } = useTimeGridDrag({
    days,
    displayItems,
    columnCount,
    hourHeight,
    dayStartMinutes,
    use24Hour,
    scrollRef,
    canvasRef,
    allDayAreaRef,
  });

  // Update current time
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Initial scroll to current time
  useEffect(() => {
    if (scrollRef.current) {
      const currentHour = now.getHours();
      const displayPosition = hourToDisplayPosition(currentHour, dayStartMinutes);
      // Scroll to show current time near the top, with some padding
      scrollRef.current.scrollTop = Math.max(0, (displayPosition - 1) * hourHeight);
    }
  }, []);

  // Calculation for CurrentTimeLine
  const nowHour = getHours(now);
  const nowMinutes = getMinutes(now);
  const nowDisplayPosition = hourToDisplayPosition(nowHour, dayStartMinutes);
  const nowTop = nowDisplayPosition * hourHeight + (nowMinutes / 60) * hourHeight;

  // Use the timezone from store or default
  const { timezone } = useCalendarStore();

  return (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-950 select-none relative">
      
      {/* Universal Header Row: Timezone + Dates + Controller */}
      <TimezoneHeader 
        timezone={String(timezone || 'GMT+8')} 
        days={days}
      />

      {/* Full Width Divider */}
      <div className="h-px bg-zinc-100 dark:bg-zinc-800 w-full flex-shrink-0" />

      {/* All-day events area */}
      <div ref={allDayAreaRef}>
        <AllDayArea
          days={days}
          allDayEvents={allDayEvents}
          gutterWidth={GUTTER_WIDTH}
          isDropTarget={isAllDayDropTarget}
          onCreateAllDay={handleCreateAllDay}
          onEventDragStart={handleAllDayEventDragStart}
          onToggle={onToggle}
        />
      </div>

      {/* Third Divider Line (Full Width) - Bottom of All Day Area */}
      <div className="h-px bg-zinc-200 dark:bg-zinc-800 w-full flex-shrink-0" />

      {/* Main body */}
      <div ref={scrollRef} id="time-grid-scroll" className="flex-1 overflow-y-auto relative neko-scrollbar">
        <div className="flex relative" style={{ minHeight: hourHeight * 24 }}>
          {/* Time labels column */}
          <TimeColumn
            hourHeight={hourHeight}
            dayStartMinutes={dayStartMinutes}
            use24Hour={use24Hour}
            dragTimeIndicator={dragTimeIndicator}
            hoverTimeIndicator={hoverTimeIndicator}
          />

          {/* Canvas */}
          <div ref={canvasRef} className="flex-1 relative" onMouseDown={handleCanvasMouseDown}>
            <GridLines
              hourHeight={hourHeight}
              columnCount={columnCount}
              days={days}
            />

            <EventsLayer
              days={days}
              timedEvents={timedEvents}
              columnCount={columnCount}
              hourHeight={hourHeight}
              dayStartMinutes={dayStartMinutes}
              onToggle={onToggle}
              isDragging={isDragging}
              dragStart={dragStart}
              dragEnd={dragEnd}
              ghostId={dragId}
              onEventDragStart={handleEventDragStart}
              onEventHover={handleEventHover}
            />

<SunLinesLayer
              days={days}
              hourHeight={hourHeight}
              dayStartMinutes={dayStartMinutes}
            />

            <CurrentTimeLine
              nowTop={nowTop}
              now={now}
              use24Hour={use24Hour}
            />

          </div>
        </div>
      </div>
    </div>
  );
}