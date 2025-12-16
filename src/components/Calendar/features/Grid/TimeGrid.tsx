import { useRef, useEffect, useState, useCallback } from 'react';
import { format, isSameDay, startOfWeek, addDays, getHours, getMinutes, startOfDay, addMinutes } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { useCalendarStore } from '@/stores/useCalendarStore';
import { useGroupStore } from '@/stores/useGroupStore'; 
import { useCalendarEvents } from '../../hooks/useCalendarEvents'; // Import Hook
import { EventBlock } from '../Event/EventBlock'; 

const HOUR_HEIGHT = 64; 
const GUTTER_WIDTH = 60;
const SNAP_MINUTES = 15;

export function TimeGrid() {
  const { selectedDate, addEvent } = useCalendarStore();
  const { toggleTask } = useGroupStore(); // Only need toggleTask now
  const displayItems = useCalendarEvents(); // Use the hook
  
  const [now, setNow] = useState(new Date());
  const scrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Drag Creation State
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number, y: number, dayIndex: number, time: number } | null>(null);
  const [dragEnd, setDragEnd] = useState<{ time: number } | null>(null);

  // 1. Maintain "The Now"
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // 2. Initial Scroll
  useEffect(() => {
    if (scrollRef.current) {
      const currentHour = now.getHours();
      scrollRef.current.scrollTop = (currentHour - 2) * HOUR_HEIGHT;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));

  // --- Interaction Logic ---

  const getDayAndTimestampFromY = (y: number, x: number) => {
    if (!containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    
    // Calculate Day Column
    const relativeX = x - rect.left - GUTTER_WIDTH; 
    const dayWidth = (rect.width - GUTTER_WIDTH) / 7;
    const dayIndex = Math.floor(relativeX / dayWidth);

    // Calculate Time
    const relativeY = y - rect.top + (scrollRef.current?.scrollTop || 0);
    const totalMinutes = (relativeY / HOUR_HEIGHT) * 60;
    
    const snappedMinutes = Math.round(totalMinutes / SNAP_MINUTES) * SNAP_MINUTES;
    
    return { dayIndex, minutes: snappedMinutes };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('.event-block')) return;
    
    const result = getDayAndTimestampFromY(e.clientY, e.clientX);
    if (!result || result.dayIndex < 0 || result.dayIndex > 6) return;

    setIsDragging(true);
    setDragStart({ 
      x: e.clientX, 
      y: e.clientY, 
      dayIndex: result.dayIndex, 
      time: result.minutes 
    });
    setDragEnd({ time: result.minutes + 60 }); 
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !dragStart) return;

    const result = getDayAndTimestampFromY(e.clientY, e.clientX);
    if (!result) return;

    const newEndTime = Math.max(result.minutes, dragStart.time + SNAP_MINUTES);
    setDragEnd({ time: newEndTime });
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    if (!isDragging || !dragStart || !dragEnd) return;

    setIsDragging(false);

    const dayDate = weekDays[dragStart.dayIndex];
    const startDate = addMinutes(startOfDay(dayDate), dragStart.time);
    const endDate = addMinutes(startOfDay(dayDate), dragEnd.time);

    addEvent({
      title: '(New Event)',
      startDate: startDate.getTime(),
      endDate: endDate.getTime(),
      isAllDay: false,
      color: 'blue'
    });

    setDragStart(null);
    setDragEnd(null);
  }, [isDragging, dragStart, dragEnd, weekDays, addEvent]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const getGhostStyle = () => {
    if (!dragStart || !dragEnd) return null;
    const startMin = dragStart.time;
    const endMin = dragEnd.time;
    const duration = endMin - startMin;

    const top = (startMin / 60) * HOUR_HEIGHT;
    const height = (duration / 60) * HOUR_HEIGHT;

    return {
      top: `${top}px`,
      height: `${height}px`,
      left: `${(dragStart.dayIndex / 7) * 100}%`,
      width: `${100 / 7}%`
    };
  };

  const nowTop = (getHours(now) * HOUR_HEIGHT) + (getMinutes(now) / 60 * HOUR_HEIGHT);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-950 select-none">
      
      {/* HEADER */}
      <div className="flex-shrink-0 flex border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 z-20">
        <div style={{ width: GUTTER_WIDTH }} className="flex-shrink-0 border-r border-zinc-100 dark:border-zinc-800/50 flex items-center justify-center text-xs text-zinc-400">
          GMT+8
        </div>
        <div className="flex-1 grid grid-cols-7">
          {weekDays.map((day) => {
            const isToday = isSameDay(day, now);
            return (
              <div key={day.toString()} className={`flex items-center justify-center gap-1 py-3 border-r border-zinc-100 dark:border-zinc-800/50 last:border-r-0 ${isToday ? 'bg-red-50/30 dark:bg-red-900/10' : ''}`}>
                <span className={`text-sm ${isToday ? 'text-red-500' : 'text-zinc-600 dark:text-zinc-400'}`}>
                  {format(day, 'EEEE', { locale: zhCN })}
                </span>
                <span className={`w-6 h-6 rounded flex items-center justify-center text-sm transition-colors ${isToday ? 'bg-red-500 text-white' : 'text-zinc-800 dark:text-zinc-200'}`}>
                  {format(day, 'd')}
                </span>
              </div>
            );
          })}
        </div>
        <div className="w-2.5 flex-shrink-0" />
      </div>

      {/* All Day Section */}
      <div className="flex-shrink-0 flex border-b border-zinc-200 dark:border-zinc-800 min-h-[40px]">
        <div style={{ width: GUTTER_WIDTH }} className="flex-shrink-0 border-r border-zinc-100 dark:border-zinc-800/50 flex items-center justify-center text-xs text-zinc-400">
          全天
        </div>
        <div className="flex-1 grid grid-cols-7">
          {weekDays.map((day) => (
            <div key={day.toString()} className="border-r border-zinc-100 dark:border-zinc-800/50 last:border-r-0 p-1">
              {/* All day events would go here */}
            </div>
          ))}
        </div>
        <div className="w-2.5 flex-shrink-0" />
      </div>

      {/* BODY */}
      <div ref={scrollRef} id="time-grid-scroll" className="flex-1 overflow-y-auto relative custom-scrollbar">
        <div className="flex min-h-full relative" ref={containerRef} onMouseDown={handleMouseDown}>
          
          {/* Gutter */}
          <div style={{ width: GUTTER_WIDTH }} className="flex-shrink-0 border-r border-zinc-100 dark:border-zinc-800/50 bg-gradient-to-b from-white to-zinc-50 dark:from-zinc-950 dark:to-zinc-900 sticky left-0 z-10">
            {Array.from({ length: 24 }).map((_, i) => (
              <div key={i} style={{ height: HOUR_HEIGHT }} className="relative text-[11px] text-zinc-400 font-medium font-mono text-right pr-3 -mt-2.5">
                {i !== 0 && <span>{i > 12 ? i - 12 : i} {i >= 12 ? 'PM' : 'AM'}</span>}
              </div>
            ))}
          </div>

          {/* Canvas */}
          <div className="flex-1 relative cursor-crosshair">
            {/* Grid Lines */}
            <div className="absolute inset-0 z-0 pointer-events-none">
               {Array.from({ length: 24 }).map((_, i) => <div key={i} style={{ height: HOUR_HEIGHT }} className="border-b border-zinc-100 dark:border-zinc-800/50 w-full" />)}
            </div>
            <div className="absolute inset-0 grid grid-cols-7 z-0 pointer-events-none">
              {weekDays.map((day, i) => <div key={i} className={`border-r border-zinc-100 dark:border-zinc-800/50 h-full ${isSameDay(day, now) ? 'bg-blue-50/10 dark:bg-blue-900/5' : ''}`} />)}
            </div>

            {/* Now Line - The Pulse of Time */}
            {weekDays.some(day => isSameDay(day, now)) && (
              <div 
                style={{ top: nowTop }}
                className="absolute left-0 right-0 z-20 flex items-center pointer-events-none transition-all duration-1000 ease-linear"
              >
                {/* The Line with Glow */}
                <div className="h-[2px] w-full bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.6)]" />
                
                {/* The Heartbeat Dot */}
                <div className="absolute -left-1.5 w-3 h-3 flex items-center justify-center">
                   <div className="absolute w-3 h-3 rounded-full bg-red-500 shadow-sm z-10" />
                   <div className="absolute w-3 h-3 rounded-full bg-red-500 animate-ping opacity-75" />
                </div>
              </div>
            )}

            {/* Events Layer (Merged Tasks & Events) */}
            <div className="absolute inset-0 z-10 grid grid-cols-7 pointer-events-none">
               {weekDays.map((day) => (
                 <div key={day.toString()} className="relative h-full pointer-events-auto">
                   {displayItems
                     .filter(item => isSameDay(new Date(item.startDate), day) && !item.isAllDay)
                     .map(item => (
                        <div key={item.id} className="event-block">
                          <EventBlock 
                            event={item} 
                            onToggle={(id) => {
                              if (item.type === 'task') {
                                toggleTask(id);
                              }
                            }}
                          />
                        </div>
                     ))}
                 </div>
               ))}
            </div>

            {/* Ghost Event */}
            {isDragging && dragStart && (
              <div style={getGhostStyle()!} className="absolute z-30 bg-blue-500/20 border-2 border-blue-500 rounded-md pointer-events-none flex items-center justify-center">
                 <span className="text-xs font-bold text-blue-600 dark:text-blue-400">New Event</span>
              </div>
            )}
            
          </div>
        </div>
      </div>
    </div>
  );
}
