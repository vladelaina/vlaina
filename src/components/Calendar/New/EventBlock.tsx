import { format } from 'date-fns';
import { type CalendarEvent } from '@/lib/storage/calendarStorage';
import { Check } from 'lucide-react';

const HOUR_HEIGHT = 64; 

interface EventBlockProps {
  event: CalendarEvent & { type?: 'event' | 'task'; originalTask?: any };
  onToggle?: (id: string) => void;
}

export function EventBlock({ event, onToggle }: EventBlockProps) {
  const durationInMinutes = (event.endDate - event.startDate) / (1000 * 60);
  const startHour = new Date(event.startDate).getHours();
  const startMinute = new Date(event.startDate).getMinutes();

  const top = (startHour * HOUR_HEIGHT) + (startMinute / 60 * HOUR_HEIGHT);
  const height = (durationInMinutes / 60) * HOUR_HEIGHT;

  const isTask = event.type === 'task';
  const isCompleted = isTask && event.originalTask?.completed;
  
  // Premium Color Palette
  // Using ring for borders to keep box-sizing clean
  const colorMap: Record<string, string> = {
    // Style: [Background, Text, CheckboxBorder, CheckboxActive]
    blue:    'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-100 ring-blue-200 dark:ring-blue-700/50',
    red:     'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-100 ring-red-200 dark:ring-red-700/50',
    green:   'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-100 ring-emerald-200 dark:ring-emerald-700/50',
    yellow:  'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-100 ring-amber-200 dark:ring-amber-700/50',
    purple:  'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-100 ring-purple-200 dark:ring-purple-700/50',
    orange:  'bg-orange-50 dark:bg-orange-900/20 text-orange-800 dark:text-orange-100 ring-orange-200 dark:ring-orange-700/50',
  };

  const colorKey = event.color || 'blue';
  // Use map or fallback to blue
  const styleStr = colorMap[colorKey] || colorMap['blue'];
  
  // Base classes for the card
  const baseClasses = `
    absolute left-0.5 right-1 rounded-[6px] overflow-hidden cursor-pointer 
    transition-all duration-200 group
    hover:z-30 hover:shadow-md hover:-translate-y-[1px]
    ${isCompleted ? 'opacity-60 grayscale-[0.5]' : 'opacity-100'}
  `;

  let innerContent;
  
  if (isTask) {
    // --- TASK STYLE ---
    // High-fidelity card with visual depth
    const priorityColor = event.originalTask?.priority || 'default';
    const isShort = height < 32;

    // Determine Accent Color based on Priority
    let accentColorClass = 'text-blue-600 dark:text-blue-400';
    let ringClass = 'ring-zinc-200 dark:ring-zinc-700';
    let bgClass = 'bg-white dark:bg-zinc-800';
    let borderLeftClass = 'border-l-[3px] border-blue-500';

    if (priorityColor === 'red') {
       borderLeftClass = 'border-l-[3px] border-red-500';
       bgClass = 'bg-red-50/50 dark:bg-red-900/10'; // Subtle tint
    } else if (priorityColor === 'green') {
       borderLeftClass = 'border-l-[3px] border-emerald-500';
       bgClass = 'bg-emerald-50/50 dark:bg-emerald-900/10';
    } else if (priorityColor === 'yellow') {
       borderLeftClass = 'border-l-[3px] border-amber-400';
       bgClass = 'bg-amber-50/50 dark:bg-amber-900/10';
    } else {
       // Default/Blue
       borderLeftClass = 'border-l-[3px] border-blue-500';
       bgClass = 'bg-white dark:bg-zinc-800';
    }

    innerContent = (
      <div 
        className={`
          w-full h-full flex flex-col
          ${bgClass}
          ${borderLeftClass}
          ring-1 ring-inset ring-black/5 dark:ring-white/10
          shadow-sm
        `}
      >
        <div className={`flex items-start gap-2 p-1.5 ${isShort ? 'items-center' : ''}`}>
          {/* Checkbox Area - The "Satisfaction Button" */}
          <div 
            onClick={(e) => {
              e.stopPropagation();
              onToggle && onToggle(event.id);
            }}
            className={`
              flex-shrink-0 w-4 h-4 rounded-[4px] border transition-all duration-200 flex items-center justify-center
              hover:scale-110 active:scale-90 z-20 cursor-pointer shadow-sm
              ${isCompleted 
                ? 'bg-zinc-500 border-zinc-500 text-white' 
                : 'border-zinc-300 dark:border-zinc-500 bg-white dark:bg-zinc-900 group-hover:border-blue-400'}
            `}
          >
            {isCompleted && <Check className="w-3 h-3" strokeWidth={3.5} />}
          </div>

          {/* Text Content */}
          <div className="flex-1 min-w-0 flex flex-col justify-center">
             <span 
               className={`
                 text-[11px] leading-tight font-semibold tracking-tight truncate 
                 ${isCompleted ? 'line-through text-zinc-400' : 'text-zinc-700 dark:text-zinc-200'}
               `}
             >
               {event.title}
             </span>
             {!isShort && (
               <span className="text-[9px] text-zinc-400 dark:text-zinc-500 font-medium tracking-wide mt-0.5 tabular-nums">
                 {format(event.startDate, 'HH:mm')} · {format(event.endDate, 'HH:mm')}
               </span>
             )}
          </div>
        </div>
      </div>
    );
  } else {
    // --- EVENT STYLE ---
    // Pure, flat, colorful block
    
    innerContent = (
      <div className={`
        w-full h-full px-2 py-1 flex flex-col justify-center
        ${styleStr}
        ring-1 ring-inset border-l-0
        rounded-[4px]
      `}>
        <div className="flex flex-col">
           <span className="text-[11px] font-semibold tracking-tight truncate leading-tight">
             {event.title}
           </span>
           {height > 30 && (
             <span className="opacity-80 text-[9px] tracking-wide font-medium tabular-nums mt-0.5">
               {format(event.startDate, 'HH:mm')}
             </span>
           )}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        top: `${top}px`,
        height: `${Math.max(height, 24)}px`, // Minimum height enforced
      }}
      className={baseClasses}
    >
      {innerContent}
    </div>
  );
}
