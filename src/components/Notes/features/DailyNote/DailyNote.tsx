/**
 * DailyNote - Daily notes functionality
 * 
 * Obsidian-style daily notes with calendar integration
 */

import { format, isToday, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths } from 'date-fns';
import { useState, useMemo } from 'react';
import { CalendarBlankIcon, CaretLeftIcon, CaretRightIcon, PlusIcon } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

interface DailyNoteProps {
  existingDates: Date[]; // Dates that have daily notes
  onDateSelect: (date: Date) => void;
  onCreateDaily: (date: Date) => void;
}

export function DailyNoteCalendar({ existingDates, onDateSelect, onCreateDaily }: DailyNoteProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const days = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  // Get day of week for first day (0 = Sunday)
  const startDayOfWeek = days[0].getDay();

  // Check if a date has a daily note
  const hasNote = (date: Date) => {
    return existingDates.some(d => isSameDay(d, date));
  };

  return (
    <div className="p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CalendarBlankIcon className="size-4 text-purple-500" weight="duotone" />
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Daily Notes
          </span>
        </div>
        <button
          onClick={() => onCreateDaily(new Date())}
          className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500"
          title="Create today's note"
        >
          <PlusIcon className="size-4" weight="bold" />
        </button>
      </div>

      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => setCurrentMonth(m => subMonths(m, 1))}
          className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          <CaretLeftIcon className="size-4 text-zinc-500" />
        </button>
        <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
          {format(currentMonth, 'MMMM yyyy')}
        </span>
        <button
          onClick={() => setCurrentMonth(m => addMonths(m, 1))}
          className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          <CaretRightIcon className="size-4 text-zinc-500" />
        </button>
      </div>

      {/* Day Headers */}
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
          <div key={i} className="text-center text-[10px] text-zinc-400 py-1">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {/* Empty cells for days before month starts */}
        {Array.from({ length: startDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} className="aspect-square" />
        ))}
        
        {/* Days */}
        {days.map((day) => {
          const hasDaily = hasNote(day);
          const today = isToday(day);
          
          return (
            <button
              key={day.toISOString()}
              onClick={() => hasDaily ? onDateSelect(day) : onCreateDaily(day)}
              className={cn(
                "aspect-square flex items-center justify-center text-xs rounded transition-colors",
                today && "ring-1 ring-purple-500",
                hasDaily 
                  ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-medium"
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              )}
            >
              {format(day, 'd')}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Generate daily note filename
 */
export function getDailyNotePath(date: Date, folder: string = 'Daily'): string {
  const dateStr = format(date, 'yyyy-MM-dd');
  return `${folder}/${dateStr}.md`;
}

/**
 * Generate daily note template
 */
export function getDailyNoteTemplate(date: Date): string {
  const dateStr = format(date, 'EEEE, MMMM d, yyyy');
  return `# ${dateStr}

## Tasks
- [ ] 

## Notes


## Journal

`;
}

/**
 * Parse date from daily note filename
 */
export function parseDailyNoteDate(filename: string): Date | null {
  const match = filename.match(/(\d{4}-\d{2}-\d{2})/);
  if (match) {
    return new Date(match[1]);
  }
  return null;
}
