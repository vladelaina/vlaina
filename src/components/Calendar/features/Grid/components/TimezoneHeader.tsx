import { useMemo } from 'react';
import { Minus, Plus } from 'lucide-react';
import { CALENDAR_CONSTANTS } from '../../../utils/timeUtils';
import { useCalendarStore } from '@/stores/useCalendarStore';

const GUTTER_WIDTH = CALENDAR_CONSTANTS.GUTTER_WIDTH as number;

interface TimezoneHeaderProps {
  timezone: string;
}

export function TimezoneHeader({ timezone }: TimezoneHeaderProps) {
  const { dayCount, setDayCount, setViewMode } = useCalendarStore();

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

  const currentDayCount = dayCount || 7; // Default to 7 if undefined, similar to TimeGrid logic

  const handleIncrement = () => {
    const next = Math.min(14, currentDayCount + 1);
    setDayCount(next);
    // Ensure we are using TimeGrid (mapped to 'week' view mode) which supports dynamic columns
    setViewMode('week');
  };

  const handleDecrement = () => {
    const next = Math.max(1, currentDayCount - 1);
    setDayCount(next);
    setViewMode('week');
  };

  return (
    <div className="flex h-5 items-center select-none bg-white dark:bg-zinc-950 pr-2">
      {/* Timezone label aligned with time column */}
      <div 
        style={{ width: GUTTER_WIDTH }} 
        className="flex-shrink-0 flex items-center justify-end pr-2"
      >
        <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium whitespace-nowrap">
          {displayTimezone}
        </span>
      </div>

      {/* Spacer to push buttons to right */}
      <div className="flex-1" />

      {/* Day Count Controls (Apple-style Progressive Disclosure) */}
      <div className="flex items-center gap-0.5">
        {currentDayCount > 1 && (
          <>
            <button 
              onClick={handleDecrement}
              className="p-0.5 rounded-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
              title="Decrease days"
            >
              <Minus className="w-3 h-3" />
            </button>
            <div className="min-w-[16px] flex justify-center items-center">
                <span className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-400 select-none animate-in fade-in zoom-in duration-200">
                    {currentDayCount}
                </span>
            </div>
          </>
        )}
        <button 
          onClick={handleIncrement}
          disabled={currentDayCount >= 14}
          className="p-0.5 rounded-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 disabled:opacity-30 transition-colors"
          title="Increase days"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
