import { format, isSameYear } from 'date-fns';
import { MdExpandMore } from 'react-icons/md';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useCalendarStore } from '@/stores/useCalendarStore';
import { MiniCalendar } from './MiniCalendar';
import { useState } from 'react';

export function DateSelector() {
  const { selectedDate } = useCalendarStore();
  const [open, setOpen] = useState(false);

  const displayText = isSameYear(selectedDate, new Date()) 
    ? format(selectedDate, 'MMMM d') 
    : format(selectedDate, 'MMM d, yyyy');
  
  const weekDay = format(selectedDate, 'EEEE');

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button 
          className="group flex flex-col items-center justify-center h-8 px-3 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors select-none outline-none"
        >
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-800 dark:group-hover:text-zinc-200 transition-colors">
              {weekDay}
            </span>
            <span className="w-0.5 h-0.5 rounded-full bg-zinc-300 dark:bg-zinc-600" />
            <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors">
              {displayText}
            </span>
            <MdExpandMore 
              className={`size-3 text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} 
            />
          </div>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="center" sideOffset={8}>
        <MiniCalendar onSelect={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}
