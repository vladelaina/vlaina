import { useMemo, useState } from 'react';
import { Icon } from '@/components/ui/icons';
import { format, isSameDay } from 'date-fns';
import { CALENDAR_CONSTANTS } from '../../../utils/timeUtils';
import { useCalendarStore } from '@/stores/useCalendarStore';
import { useUIStore } from '@/stores/uiSlice';
import { useGroupStore } from '@/stores/useGroupStore';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { MiniCalendar } from '../../DateSelector/MiniCalendar';
import { WeatherWidget } from '../../Header/WeatherWidget';

const GUTTER_WIDTH = CALENDAR_CONSTANTS.GUTTER_WIDTH as number;
const QUICK_MODES = ['day', 'week', 'month'] as const;

interface TimezoneHeaderProps {
  days?: Date[]; 
}

export function TimezoneHeader({ days = [] }: TimezoneHeaderProps) {
  const { dayCount, setDayCount, viewMode, setViewMode, setSelectedDate, selectedDate } = useCalendarStore();
  const { setAppViewMode } = useUIStore();
  const { setActiveGroup } = useGroupStore();
  
  const [open, setOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const currentDayCount = dayCount || 7;

  const label = useMemo(() => {
    if (viewMode === 'month') return 'Month';
    if (currentDayCount === 1) return 'Day';
    if (currentDayCount === 7) return 'Week';
    return `${currentDayCount} Days`;
  }, [viewMode, currentDayCount]);

  const handleIncrement = () => {
    if (viewMode === 'day' || (viewMode === 'week' && currentDayCount === 1)) {
        setDayCount(2);
        setViewMode('week');
    } else if (viewMode === 'week') {
        if (currentDayCount < 14) {
            setDayCount(currentDayCount + 1);
        } else {
            setViewMode('month');
        }
    }
  };

  const handleDecrement = () => {
    if (viewMode === 'month') {
        setViewMode('week');
        setDayCount(7);
    } else if (viewMode === 'week' && currentDayCount > 1) {
        setDayCount(currentDayCount - 1);
    }
  };
  
  const handleQuickSelect = (mode: 'day' | 'week' | 'month') => {
      if (mode === 'day') { setDayCount(1); setViewMode('day'); }
      else if (mode === 'week') { setDayCount(7); setViewMode('week'); }
      else if (mode === 'month') { setViewMode('month'); }
      setOpen(false);
  };

  const handleJumpToTodo = () => {
    setActiveGroup('today');
    setAppViewMode('todo');
  };

  const isMaxZoomOut = viewMode === 'month';
  const isMaxZoomIn = viewMode !== 'month' && currentDayCount === 1;

  return (
    <div className="flex h-7 items-center select-none bg-white dark:bg-zinc-950 border-b border-zinc-100 dark:border-zinc-800/50 relative">
      {/* 1. Left Gutter - Weather & Todo Button */}
      <div 
        style={{ width: GUTTER_WIDTH }} 
        className="flex-shrink-0 flex items-center justify-end pr-1 gap-1"
      >
        {viewMode !== 'month' && (
          <>
            <WeatherWidget />
            <button
              onClick={handleJumpToTodo}
              className="p-0.5 text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-sm transition-colors"
              title="Open in Today List"
            >
 <Icon size="md" name="editor.checkSquare" />
            </button>
          </>
        )}
      </div>

      {/* 2. Date Columns (Grid) */}
      <div className="flex-1 min-w-0 h-full" style={{ paddingRight: '120px' }}>
        {viewMode !== 'month' && days.length > 0 && (
          <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
            <PopoverTrigger asChild>
                <button className="w-full h-full grid items-center hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors group/dates outline-none"
                        style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}>
                    {days.map((day) => {
                        const isToday = isSameDay(day, new Date());

                        return (
                            <div key={day.toString()} className="flex items-center justify-center h-full px-0.5 overflow-hidden">
                                <div className="flex items-center gap-1.5 max-w-full">
                                    {/* Date Parts */}
                                    <div className="flex items-baseline gap-1 flex-shrink-0">
                                        <span className={isToday ? "text-zinc-900 dark:text-zinc-100 text-[10px] font-bold" : "text-zinc-400 dark:text-zinc-500 text-[10px]"}>
                                            {format(day, 'EEE')}
                                        </span>
                                        <span className={isToday 
                                            ? "flex items-center justify-center w-5 h-5 rounded-sm bg-[#f04842] text-white text-[11px] font-bold shadow-sm" 
                                            : "text-zinc-600 dark:text-zinc-300 text-[11px] font-semibold"}>
                                            {format(day, 'd')}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2" align="center" sideOffset={4}>
                <MiniCalendar onSelect={(d) => { setSelectedDate(d); setDatePickerOpen(false); }} />
            </PopoverContent>
          </Popover>
        )}
      </div>

      {/* 3. Right Controls: Absolute Positioning */}
      <div className={`absolute right-2 top-0 bottom-0 flex items-center gap-2 z-20`}>
        
        {/* Today button - only show when not on today */}
        {!isSameDay(selectedDate, new Date()) && (
          <button
            onClick={() => setSelectedDate(new Date())}
            className="whitespace-nowrap px-1.5 py-0.5 text-[10px] font-medium text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 bg-zinc-100 dark:bg-zinc-800/50 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-sm transition-all"
          >
            Today
          </button>
        )}

        {!isSameDay(selectedDate, new Date()) && (
          <div className="h-[18px] w-px bg-zinc-200 dark:bg-zinc-800" />
        )}

        {/* View Scale Controller */}
        <div className="flex items-center gap-0.5">
            <button 
            onClick={handleDecrement}
            disabled={isMaxZoomIn}
            className={`p-0.5 rounded-sm transition-colors ${isMaxZoomIn ? 'text-zinc-200 dark:text-zinc-800' : 'text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
            >
 <Icon size="md" name="common.remove" />
            </button>

            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <button className="h-5 px-1.5 flex items-center justify-center gap-1 rounded-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors outline-none">
                        <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-tight">
                            {label}
                        </span>
                        <Icon name="nav.chevronDown" className="w-2.5 h-2.5 text-zinc-400" />
                    </button>
                </PopoverTrigger>
                <PopoverContent className="w-32 p-1" align="end">
                    <div className="flex flex-col gap-0.5">
                        {QUICK_MODES.map((m) => (
                            <button key={m} onClick={() => handleQuickSelect(m)} className="flex items-center justify-between px-2 py-1.5 text-xs rounded-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                                <span className="capitalize">{m}</span>
 {((m === 'day' && currentDayCount === 1 && viewMode !== 'month') || (m === 'week' && currentDayCount === 7 && viewMode === 'week') || (m === 'month' && viewMode === 'month')) && <Icon size="md" name="common.check" />}
                            </button>
                        ))}
                    </div>
                </PopoverContent>
            </Popover>

            <button 
            onClick={handleIncrement}
            disabled={isMaxZoomOut}
            className={`p-0.5 rounded-sm transition-colors ${isMaxZoomOut ? 'text-zinc-200 dark:text-zinc-800' : 'text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
            >
 <Icon size="md" name="common.add" />
            </button>
        </div>
      </div>
    </div>
  );
}
