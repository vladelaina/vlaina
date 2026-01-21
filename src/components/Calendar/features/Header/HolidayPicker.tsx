import { useState } from 'react';
import { CalendarDays, Globe, Check, Loader2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { HOLIDAY_REGIONS } from '@/lib/calendar/holidayService';
import { useHolidayStore } from '@/stores/useHolidayStore';

export function HolidayPicker() {
  const { subscribedRegionId, subscribe, isLoading } = useHolidayStore();
  const [open, setOpen] = useState(false);

  const currentRegion = HOLIDAY_REGIONS.find(r => r.id === subscribedRegionId);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors group outline-none">
          <CalendarDays className="size-4 text-zinc-500 dark:text-zinc-400" />
          {currentRegion && (
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest hidden sm:inline">
              {currentRegion.id}
            </span>
          )}
          {isLoading && <Loader2 className="size-3 animate-spin text-zinc-400" />}
        </button>
      </PopoverTrigger>
      
      <PopoverContent className="w-56 p-0 overflow-hidden bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800" align="end" sideOffset={8}>
        <div className="p-3 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2 text-xs font-bold text-zinc-400 uppercase tracking-wider">
            <Globe className="size-3" />
            <span>Regional Holidays</span>
          </div>
        </div>

        <div className="max-h-64 overflow-y-auto neko-scrollbar p-1">
          <button
            onClick={() => {
              subscribe(null);
              setOpen(false);
            }}
            className={cn(
              "w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors",
              !subscribedRegionId ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400" : "hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
            )}
          >
            <span>None</span>
            {!subscribedRegionId && <Check className="size-3.5" />}
          </button>

          <div className="h-px bg-zinc-100 dark:bg-zinc-800 my-1" />

          {HOLIDAY_REGIONS.map((region) => (
            <button
              key={region.id}
              onClick={() => {
                subscribe(region.id);
                setOpen(false);
              }}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors",
                subscribedRegionId === region.id ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400" : "hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
              )}
            >
              <div className="flex items-center gap-3">
                <span className="text-base">{region.flag}</span>
                <span>{region.name}</span>
              </div>
              {subscribedRegionId === region.id && <Check className="size-3.5" />}
            </button>
          ))}
        </div>
        
        <div className="p-2 bg-zinc-50 dark:bg-zinc-950 text-[9px] text-zinc-400 text-center border-t border-zinc-100 dark:border-zinc-800">
          Holidays provided by Google Calendar
        </div>
      </PopoverContent>
    </Popover>
  );
}
