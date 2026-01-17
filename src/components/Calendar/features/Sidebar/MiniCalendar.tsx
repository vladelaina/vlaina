import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { ChevronUp, ChevronDown, Undo2 } from 'lucide-react';
import { useCalendarStore } from '@/stores/useCalendarStore';
import { useUIStore } from '@/stores/uiSlice';
import { useState } from 'react';
import { ALL_COLORS, COLOR_HEX, RAINBOW_GRADIENT } from '@/lib/colors';

export function MiniCalendar() {
  const { selectedDate, setSelectedDate } = useCalendarStore();
  const [currentMonth, setCurrentMonth] = useState(selectedDate);

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

  const isCurrentMonthDisplayed = isSameMonth(currentMonth, new Date());

  const handleDayClick = (day: Date) => {
    setSelectedDate(day);
    if (!isSameMonth(day, currentMonth)) {
      setCurrentMonth(day);
    }
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

            return (
              <div
                key={day.toString()}
                onClick={() => handleDayClick(day)}
                className={`
                  h-7 flex items-center justify-center text-xs cursor-pointer relative rounded-md transition-colors
                  ${!isCurrentMonth ? 'text-zinc-300 dark:text-zinc-700' : 'text-zinc-700 dark:text-zinc-300'}
                  ${isSelected && !isToday ? 'bg-zinc-100 dark:bg-zinc-800 font-semibold' : ''}
                  ${!isSelected && !isToday && isCurrentMonth ? 'hover:bg-zinc-100 dark:hover:bg-zinc-800' : ''}
                `}
              >
                {isToday ? (
                  <div className="w-6 h-6 bg-red-500 rounded flex items-center justify-center shadow-sm">
                    <span className="text-white font-semibold text-[10px]">{format(day, 'd')}</span>
                  </div>
                ) : (
                  <span>{format(day, 'd')}</span>
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

function ColorFilter() {
  const { selectedColors, toggleColor, toggleAllColors } = useUIStore();

  return (
    <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800">
      <div className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 mb-2 uppercase tracking-wide">Filters</div>
      <div className="flex items-center gap-2 flex-wrap">
        {/* Color options - in new order */}
        {ALL_COLORS.map(color => (
          <button
            key={color}
            onClick={() => toggleColor(color)}
            className={`w-3.5 h-3.5 rounded-full border transition-all hover:scale-110 ${selectedColors.includes(color)
              ? 'ring-1 ring-zinc-400 dark:ring-zinc-500 ring-offset-1 dark:ring-offset-zinc-900 border-transparent shadow-sm'
              : 'border-transparent opacity-70 hover:opacity-100'
              }`}
            style={{
              backgroundColor: color === 'default' ? '#a1a1aa' : COLOR_HEX[color] // distinct grey for default
            }}
            title={color}
          />
        ))}
        {/* Select all button */}
        <button
          onClick={() => toggleAllColors()}
          className={`w-4 h-4 rounded-full transition-all hover:scale-110 relative overflow-hidden ml-auto ${selectedColors.length === ALL_COLORS.length
            ? 'ring-1 ring-zinc-400 dark:ring-zinc-500 ring-offset-1 dark:ring-offset-zinc-900 shadow-sm'
            : 'opacity-70 hover:opacity-100'
            }`}
          style={{ background: RAINBOW_GRADIENT }}
          title="Toggle All"
        />
      </div>
    </div>
  );
}
