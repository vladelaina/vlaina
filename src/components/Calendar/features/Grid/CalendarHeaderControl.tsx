import { useMemo, useState, useEffect } from 'react';
import { format, startOfWeek, addDays, isSameDay } from 'date-fns';
import { ChevronDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { MiniCalendar } from '../DateSelector/MiniCalendar';
import { WeatherWidget } from '../Header/WeatherWidget';
import { HolidayPicker } from '../Header/HolidayPicker';
import { useCalendarStore } from '@/stores/useCalendarStore';
import { useHolidayStore } from '@/stores/useHolidayStore';

export function CalendarHeaderControl() {
  const { selectedDate, setSelectedDate, viewMode, dayCount } = useCalendarStore();
  const { holidays, subscribedRegionId, refresh, isLoading } = useHolidayStore();
  
  // Auto-refresh holidays on mount if subscribed but empty
  useEffect(() => {
      if (subscribedRegionId && holidays.length === 0 && !isLoading) {
          refresh();
      }
  }, [subscribedRegionId, holidays.length, isLoading, refresh]);

  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const days = useMemo(() => {
    if (viewMode === 'week') {
      const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
      return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    }
    if (viewMode === 'day') {
      return Array.from({ length: dayCount || 1 }, (_, i) => addDays(selectedDate, i));
    }
    return [];
  }, [viewMode, selectedDate, dayCount]);

  const getHolidayForDay = (day: Date) => {
    return holidays.find(h => isSameDay(h.dtstart, day));
  };

  if (viewMode === 'month') {
    // For month view, just show Month/Year selector centered
    return (
      <div className="flex items-center justify-center w-full" data-tauri-drag-region>
        <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
          <PopoverTrigger asChild>
            <button className="flex items-center gap-2 px-3 py-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors group outline-none">
              <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                {format(selectedDate, 'MMMM yyyy')}
              </span>
              <ChevronDown className={`size-3 text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-transform duration-200 ${datePickerOpen ? 'rotate-180' : ''}`} />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" align="center" sideOffset={8}>
            <MiniCalendar onSelect={() => setDatePickerOpen(false)} />
          </PopoverContent>
        </Popover>

        <WeatherWidget />
        <HolidayPicker />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-full relative w-full" data-tauri-drag-region>
      {/* Date Container */}
      <div className="flex items-center gap-2 h-full relative group/container">
        <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
          <PopoverTrigger asChild>
            <button className="h-full flex items-center gap-4 px-4 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group outline-none">
              <div className="flex items-center gap-6">
                {days.map((day) => {
                  const holiday = getHolidayForDay(day);
                  return (
                    <div key={day.toString()} className="flex flex-col items-center justify-center min-w-[32px]">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                          {format(day, 'EEE')}
                        </span>
                        <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                          {format(day, 'd')}
                        </span>
                      </div>
                      {holiday && (
                        <span className="text-[9px] font-medium text-red-500/90 dark:text-red-400/90 leading-tight max-w-[60px] truncate -mb-1">
                          {holiday.summary}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              <ChevronDown className={`size-3 text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-transform duration-200 ${datePickerOpen ? 'rotate-180' : ''}`} />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" align="center" sideOffset={8}>
            <MiniCalendar onSelect={() => setDatePickerOpen(false)} />
          </PopoverContent>
        </Popover>

        <WeatherWidget />
        <HolidayPicker />

        {/* Today Button - Appears next to the date group */}
        {!days.some(day => isSameDay(day, new Date())) && (
          <div>
            <button
              onClick={() => setSelectedDate(new Date())}
              className="whitespace-nowrap px-2 py-0.5 text-xs font-medium text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 bg-zinc-100 dark:bg-zinc-800/50 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-md transition-all animate-in fade-in slide-in-from-left-2 duration-200"
            >
              Today
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
