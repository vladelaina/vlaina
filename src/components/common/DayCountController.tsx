import React from 'react';
import { Minus, Plus } from 'lucide-react';
import { useCalendarStore } from '@/stores/useCalendarStore';
import { cn } from '@/lib/utils';

export function DayCountController() {
  const { dayCount = 7, setDayCount, viewMode, setViewMode } = useCalendarStore();

  const handleChange = (delta: number) => {
    const currentCount = dayCount || 7;
    const newCount = Math.max(1, currentCount + delta);
    
    // Update the count
    setDayCount(newCount);
    
    // If we are modifying the day count, we implicitly want to be in a view that supports it.
    // 'week' view maps to TimeGrid, which we modified to support dynamic dayCount.
    if (viewMode !== 'week') {
        setViewMode('week');
    }
  };

  return (
    <div className="flex items-center gap-0.5 bg-white dark:bg-zinc-900 rounded-md border border-zinc-200 dark:border-zinc-800 p-0.5 shadow-sm h-8">
        {dayCount > 1 && (
            <>
                <button
                    onClick={() => handleChange(-1)}
                    className="h-6 w-6 flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
                    aria-label="Decrease day count"
                >
                    <Minus className="w-4 h-4" />
                </button>
                <div className="min-w-[1.25rem] flex justify-center items-center">
                    <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 select-none animate-in fade-in zoom-in duration-200">
                        {dayCount}
                    </span>
                </div>
            </>
        )}
        <button
            onClick={() => handleChange(1)}
            className="h-6 w-6 flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
            aria-label="Increase day count"
        >
            <Plus className="w-4 h-4" />
        </button>
    </div>
  );
}
