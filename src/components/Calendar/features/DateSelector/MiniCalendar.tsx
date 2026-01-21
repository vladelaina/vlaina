import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { ChevronUp, ChevronDown, Undo2 } from 'lucide-react';
import { useCalendarStore } from '@/stores/useCalendarStore';
import { useHolidayStore } from '@/stores/useHolidayStore';
import { useState, useEffect } from 'react';
import { ColorFilter } from '@/components/common/ColorFilter';

interface MiniCalendarProps {
  onSelect?: (date: Date) => void;
  // selectedDate is now managed globally, but we can accept it if we want to override or init (optional, but current code uses store)
  // strict mode: remove unused props from call sites or add them here.
  // The errors show: Type '{ selectedDate: Date; onSelect: ... }'
  // So we should probably allow selectedDate in props too, even if we ignore it or sync it,
  // OR update call sites to NOT pass selectedDate.
  // Given the goal is "fix errors", adding it to props is safest if we want to keep call sites mostly same,
  // BUT the store is the source of truth. Let's add it as optional to satisfy TS but ignore it or use it to init state if provided?
  // Actually, better to clean up call sites. But to fix the "not assignable" error, we need to accept what's passed OR change what's passed.
  // I will change what's passed in the other files. Here I just add onSelect.
}

export function MiniCalendar({ onSelect }: MiniCalendarProps) {
  const { selectedDate, setSelectedDate } = useCalendarStore();
  const { holidays } = useHolidayStore();
  const [currentMonth, setCurrentMonth] = useState(selectedDate);

  // Sync current month when selected date changes (e.g. via "Today" button in header)
  useEffect(() => {
    setCurrentMonth(selectedDate);
  }, [selectedDate]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  // Start from Sunday
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const jumpToToday = () => {
    const today = new Date();
    setCurrentMonth(today);
    setSelectedDate(today);
  };

  const getHolidayForDay = (day: Date) => {
    return holidays.find(h => isSameDay(h.dtstart, day));
  };

  const isCurrentMonthDisplayed = isSameMonth(currentMonth, new Date());

  const handleDayClick = (day: Date) => {
    setSelectedDate(day);
    if (!isSameMonth(day, currentMonth)) {
      setCurrentMonth(day);
    }
    onSelect?.(day);
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
                <Undo2 className="size-3.5" strokeWidth={2} />
              </button>
            )}
            <button
              onClick={prevMonth}
              className="p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
            >
              <ChevronUp className="size-4" strokeWidth={2} />
            </button>
            <button
              onClick={nextMonth}
              className="p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
            >
              <ChevronDown className="size-4" strokeWidth={2} />
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
            const holiday = getHolidayForDay(day);

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
                
                {holiday && (
                  <span className="text-[8px] leading-none text-red-500 dark:text-red-400 truncate max-w-full px-0.5 scale-90 origin-top">
                    {holiday.summary}
                  </span>
                )}
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

// Local ColorFilter removed
