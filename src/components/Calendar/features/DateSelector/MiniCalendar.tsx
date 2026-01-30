import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { MdExpandLess, MdExpandMore, MdUndo } from 'react-icons/md';
import { useCalendarStore } from '@/stores/useCalendarStore';
import { useState, useEffect, useMemo } from 'react';
import { ColorFilter } from '@/components/common/ColorFilter';
import { getColorHex, getColorPriority } from '@/lib/colors';

interface MiniCalendarProps {
  onSelect?: (date: Date) => void;
}

export function MiniCalendar({ onSelect }: MiniCalendarProps) {
  const { selectedDate, setSelectedDate, allEvents } = useCalendarStore();
  const [currentMonth, setCurrentMonth] = useState(selectedDate);

  // Sync current month when selected date changes
  useEffect(() => {
    setCurrentMonth(selectedDate);
  }, [selectedDate]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Pre-calculate incomplete events by date for density display
  const eventsByDate = useMemo(() => {
    const map = new Map<string, typeof allEvents>();
    if (!allEvents) return map;

    for (const event of allEvents) {
      if (event.completed) continue; // Only show incomplete tasks
      
      const date = event.dtstart;
      if (!date || isNaN(date.getTime())) continue; // Skip invalid dates

      const dateStr = format(date, 'yyyy-MM-dd');
      if (!map.has(dateStr)) {
        map.set(dateStr, []);
      }
      map.get(dateStr)!.push(event);
    }
    
    // Sort events by priority for consistent display order
    for (const [_, events] of map) {
      events.sort((a, b) => getColorPriority(a.color) - getColorPriority(b.color));
    }
    
    return map;
  }, [allEvents]);

  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const jumpToToday = () => {
    const today = new Date();
    setCurrentMonth(today);
    setSelectedDate(today);
  };

  const isCurrentMonthDisplayed = isSameMonth(currentMonth, new Date());

  const handleDayClick = (day: Date) => {
    setSelectedDate(day);
    if (!isSameMonth(day, currentMonth)) {
      setCurrentMonth(day);
    }
    onSelect?.(day);
  };

  const renderIndicators = (day: Date) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const events = eventsByDate.get(dateStr) || [];
    const count = events.length;

    if (count === 0) return null;

    // 1-3 Events: Dots
    if (count <= 3) {
      return (
        <div className="flex gap-0.5 mt-0.5">
          {events.map((event) => (
            <div
              key={event.uid}
              className="w-1 h-1 rounded-full"
              style={{ backgroundColor: getColorHex(event.color) }}
            />
          ))}
        </div>
      );
    }

    // >3 Events: Color Bar (Spectrum/Barcode style)
    // Fixed length, every task is a slice. High density = thin slices.
    return (
      <div className="flex w-5 h-1 rounded-full overflow-hidden mt-0.5 min-w-[20px]">
        {events.map((event) => (
          <div
            key={event.uid}
            style={{ backgroundColor: getColorHex(event.color) }}
            className="flex-1 h-full"
          />
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4 font-sans">
      {/* Calendar Widget */}
      <div className="select-none">
        {/* Month/Year and Navigation */}
        <div className="flex items-center justify-between mb-3 pl-1">
          <span className="text-sm font-semibold text-zinc-600 dark:text-zinc-300">
            {format(currentMonth, 'MMMM yyyy')}
          </span>
          <div className="flex items-center gap-1">
            {!isCurrentMonthDisplayed && (
              <button
                onClick={jumpToToday}
                className="p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors mr-1"
                title="Return to Today"
              >
                <MdUndo className="size-3.5" />
              </button>
            )}
            <button
              onClick={prevMonth}
              className="p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
            >
              <MdExpandLess className="size-4" />
            </button>
            <button
              onClick={nextMonth}
              className="p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
            >
              <MdExpandMore className="size-4" />
            </button>
          </div>
        </div>

        {/* Days Header - Weekday names */}
        <div className="grid grid-cols-7 text-center mb-1">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
            <div key={i} className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500">
              {d}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-y-1">
          {days.map((day) => {
            const isToday = isSameDay(day, new Date());
            const isSelected = isSameDay(day, selectedDate);
            const isCurrentMonth = isSameMonth(day, currentMonth);

            return (
              <div
                key={day.toString()}
                onClick={() => handleDayClick(day)}
                className={`
                  h-9 flex flex-col items-center justify-start pt-1 cursor-pointer relative rounded-md transition-colors
                  ${!isCurrentMonth ? 'text-zinc-300 dark:text-zinc-700' : 'text-zinc-700 dark:text-zinc-300'}
                  ${isSelected && !isToday ? 'bg-zinc-100 dark:bg-zinc-800 font-semibold' : ''}
                  ${!isSelected && !isToday && isCurrentMonth ? 'hover:bg-zinc-100 dark:hover:bg-zinc-800' : ''}
                `}
              >
                {isToday ? (
                  <div className="w-6 h-6 bg-red-500 rounded flex items-center justify-center shadow-sm shrink-0">
                    <span className="text-white font-semibold text-[10px]">{format(day, 'd')}</span>
                  </div>
                ) : (
                  <span className="h-6 flex items-center justify-center shrink-0">{format(day, 'd')}</span>
                )}
                
                {/* Density Indicators */}
                {renderIndicators(day)}
                
              </div>
            );
          })}
        </div>
      </div>

      {/* Color Filter */}
      <ColorFilter />
    </div>
  );
}
