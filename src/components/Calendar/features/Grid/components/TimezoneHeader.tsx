import { useMemo, useState } from 'react';
import { Minus, Plus, ChevronDown, Check } from 'lucide-react';
import { CALENDAR_CONSTANTS } from '../../../utils/timeUtils';
import { useCalendarStore } from '@/stores/useCalendarStore';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const GUTTER_WIDTH = CALENDAR_CONSTANTS.GUTTER_WIDTH as number;

interface TimezoneHeaderProps {
  timezone: string;
}

export function TimezoneHeader({ timezone }: TimezoneHeaderProps) {
  const { dayCount, setDayCount, viewMode, setViewMode } = useCalendarStore();
  const [open, setOpen] = useState(false);

  // Format timezone string to ensure it's shown as GMT+X
  const displayTimezone = useMemo(() => {
    if (!timezone) return 'GMT+8';
    const tzStr = String(timezone);
    if (tzStr.startsWith('GMT')) return tzStr;
    if (tzStr.startsWith('+') || tzStr.startsWith('-')) return `GMT${tzStr}`;
    // If it's just a number
    if (!isNaN(Number(tzStr))) {
      const offset = Number(tzStr);
      return `GMT${offset >= 0 ? '+' : ''}${offset}`;
    }
    return tzStr;
  }, [timezone]);

  const currentDayCount = dayCount || 7;

  // Determine current label
  const label = useMemo(() => {
    if (viewMode === 'month') return 'Month';
    if (currentDayCount === 1) return 'Day';
    if (currentDayCount === 7) return 'Week';
    return `${currentDayCount} Days`;
  }, [viewMode, currentDayCount]);

  const handleIncrement = () => {
    // Zoom Out Logic
    if (viewMode === 'day' || (viewMode === 'week' && currentDayCount === 1)) {
        setDayCount(2);
        setViewMode('week');
    } else if (viewMode === 'week') {
        if (currentDayCount < 7) {
            setDayCount(currentDayCount + 1);
        } else if (currentDayCount === 7) {
            setDayCount(currentDayCount + 1);
        } else if (currentDayCount < 14) {
            setDayCount(currentDayCount + 1);
        } else {
            // > 14 days -> Month
            setViewMode('month');
        }
    } else if (viewMode === 'month') {
        // Already at max zoom out
    }
  };

  const handleDecrement = () => {
    // Zoom In Logic
    if (viewMode === 'month') {
        setViewMode('week');
        setDayCount(7);
    } else if (viewMode === 'week') {
        if (currentDayCount > 1) {
            setDayCount(currentDayCount - 1);
        }
        if (currentDayCount - 1 === 1) {
             // Optional: switch to 'day' mode if strictly needed
             // setViewMode('day');
        }
    }
  };
  
  const handleQuickSelect = (mode: 'day' | 'week' | 'month') => {
      if (mode === 'day') {
          setDayCount(1);
          setViewMode('day'); 
      } else if (mode === 'week') {
          setDayCount(7);
          setViewMode('week');
      } else if (mode === 'month') {
          setViewMode('month');
      }
      setOpen(false);
  };

  const isMaxZoomOut = viewMode === 'month';
  const isMaxZoomIn = viewMode !== 'month' && currentDayCount === 1;

  return (
    <div className="flex h-5 items-center select-none bg-white dark:bg-zinc-950 pr-2 border-b border-transparent">
      {/* Timezone label aligned with time column - Hidden in Month View */}
      <div 
        style={{ width: GUTTER_WIDTH }} 
        className="flex-shrink-0 flex items-center justify-end pr-2"
      >
        {viewMode !== 'month' && (
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium whitespace-nowrap">
            {displayTimezone}
          </span>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Unified Time Scale Controller (User Preferred Location) */}
      <div className="flex items-center gap-0.5 group">
        
        {/* Zoom In (-) */}
        <button 
          onClick={handleDecrement}
          disabled={isMaxZoomIn}
          className={`p-0.5 rounded-sm transition-colors ${
              isMaxZoomIn 
              ? 'text-zinc-200 dark:text-zinc-800 cursor-default' 
              : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }`}
          title="Zoom In (Show Less)"
        >
          <Minus className="w-3 h-3" />
        </button>

        {/* Scale Label / Popover Trigger */}
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button className="h-4 min-w-[3.5rem] px-1 flex items-center justify-center gap-1 rounded-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors outline-none">
                    <span className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-400 select-none">
                        {label}
                    </span>
                    <ChevronDown className="w-2.5 h-2.5 text-zinc-400" />
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-32 p-1" align="end" sideOffset={4}>
                <div className="flex flex-col gap-0.5">
                    <button 
                        onClick={() => handleQuickSelect('day')}
                        className="flex items-center justify-between px-2 py-1.5 text-xs rounded-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors"
                    >
                        <span>Day</span>
                        {viewMode !== 'month' && currentDayCount === 1 && <Check className="w-3 h-3" />}
                    </button>
                    <button 
                        onClick={() => handleQuickSelect('week')}
                        className="flex items-center justify-between px-2 py-1.5 text-xs rounded-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors"
                    >
                        <span>Week</span>
                        {viewMode === 'week' && currentDayCount === 7 && <Check className="w-3 h-3" />}
                    </button>
                    <button 
                        onClick={() => handleQuickSelect('month')}
                        className="flex items-center justify-between px-2 py-1.5 text-xs rounded-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors"
                    >
                        <span>Month</span>
                        {viewMode === 'month' && <Check className="w-3 h-3" />}
                    </button>
                </div>
            </PopoverContent>
        </Popover>

        {/* Zoom Out (+) */}
        <button 
          onClick={handleIncrement}
          disabled={isMaxZoomOut}
          className={`p-0.5 rounded-sm transition-colors ${
              isMaxZoomOut 
              ? 'text-zinc-200 dark:text-zinc-800 cursor-default' 
              : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }`}
          title="Zoom Out (Show More)"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
