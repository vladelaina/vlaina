
import type { NekoEvent } from '@/stores/useCalendarStore';
import { EventBlock } from '../../Event/EventBlock';
import { calculateEventLayout } from '../../../utils/eventLayout';
import { isEventInVisualDay, minutesToPixels } from '../../../utils/timeUtils';
import { calculateDragEventTimes } from '../../../utils/dragUtils';

interface EventsLayerProps {
    days: Date[];
    timedEvents: NekoEvent[];
    columnCount: number;
    hourHeight: number;
    dayStartMinutes: number;
    onToggle?: (id: string) => void;

    // Drag state for Ghost Event
    isDragging: boolean;
    dragStart: { dayIndex: number; minutes: number } | null;
    dragEnd: { minutes: number } | null;
    ghostId?: string | null;

    // Handlers
    onEventDragStart: (id: string, edge: 'top' | 'bottom' | null, clientY: number) => void;
    onEventHover: (start: number | null, end: number | null) => void;
}

export function EventsLayer({
    days,
    timedEvents,
    columnCount,
    hourHeight,
    dayStartMinutes,
    onToggle,
    isDragging,
    dragStart,
    dragEnd,
    ghostId,
    onEventDragStart,
    onEventHover,
}: EventsLayerProps) {
    return (
        <div
            className="absolute inset-0 z-10 grid pointer-events-none"
            style={{ gridTemplateColumns: `repeat(${columnCount}, 1fr)` }}
        >
            {days.map((day, dayIdx) => {
                const dayEvents = timedEvents.filter(
                    item => isEventInVisualDay(item.dtstart.getTime(), day, dayStartMinutes)
                );

                // Map to LayoutEvent for layout calculation
                const layoutEvents = dayEvents.map(e => ({
                    id: e.uid,
                    startDate: e.dtstart.getTime(),
                    endDate: e.dtend.getTime(),
                    color: e.color,
                    completed: e.completed
                }));

                // Ghost event handling
                const isCreatingOnThisDay = isDragging && dragStart && dragEnd &&
                    dragStart.dayIndex === dayIdx && dragStart.minutes !== dragEnd.minutes;

                let layoutMap;
                let ghostLayout;
                let renderStartMin = 0;
                let renderEndMin = 0;

                if (isCreatingOnThisDay) {
                    const dayDate = days[dragStart!.dayIndex];
                    const { 
                        actualStartMin, 
                        actualEndMin, 
                        startDate, 
                        endDate, 
                        isValid 
                    } = calculateDragEventTimes(
                        dragStart!.minutes, 
                        dragEnd!.minutes, 
                        dayDate, 
                        dayStartMinutes
                    );
                    
                    if (isValid) {
                        renderStartMin = actualStartMin;
                        renderEndMin = actualEndMin;

                        const ghostStartTime = startDate.getTime();
                        const ghostEndTime = endDate.getTime();
                        
                        const currentGhostId = ghostId || '__ghost__';

                        const ghostEvent = {
                            id: currentGhostId,
                            startDate: ghostStartTime,
                            endDate: ghostEndTime,
                            color: 'blue' as const,
                            completed: false, // Ghost is always incomplete
                        };
                        
                        // Always calculate layout including the ghost event
                        // This prevents UI jumps when switching between overlap/non-overlap states
                        // The layout algorithm handles non-overlapping events correctly (assigning full width)
                        layoutMap = calculateEventLayout([...layoutEvents, ghostEvent]);
                        ghostLayout = layoutMap.get(currentGhostId);
                    } else {
                        layoutMap = calculateEventLayout(layoutEvents);
                    }
                } else {
                    layoutMap = calculateEventLayout(layoutEvents);
                }

                return (
                    <div key={day.toString()} className="relative h-full">
                        {dayEvents.map(item => (
                            <div key={item.uid} className="event-block pointer-events-auto">
                                <EventBlock
                                    event={item}
                                    layout={layoutMap.get(item.uid)}
                                    hourHeight={hourHeight}
                                    onToggle={onToggle}
                                    onDragStart={onEventDragStart}
                                    onHover={onEventHover}
                                    dayStartMinutes={dayStartMinutes}
                                />
                            </div>
                        ))}

                        {/* Ghost event for drag-to-create */}
                        {isCreatingOnThisDay && ghostLayout && (
                            <div
                                style={{
                                    position: 'absolute',
                                    top: `${minutesToPixels(renderStartMin, hourHeight, dayStartMinutes)}px`,
                                    height: `${minutesToPixels(renderEndMin, hourHeight, dayStartMinutes) - minutesToPixels(renderStartMin, hourHeight, dayStartMinutes)}px`,
                                    left: `${ghostLayout.leftPercent}%`,
                                    width: `${ghostLayout.widthPercent}%`,
                                }}
                                className="z-50 bg-zinc-400/20 border-2 border-zinc-400 rounded-md pointer-events-none"
                            />
                        )}
                    </div>
                );
            })}
        </div>
    );
}
