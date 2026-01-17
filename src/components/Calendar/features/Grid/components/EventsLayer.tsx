
import type { NekoEvent } from '@/stores/useCalendarStore';
import { EventBlock } from '../../Event/EventBlock';
import { calculateEventLayout } from '../../../utils/eventLayout';
import { isEventInVisualDay, minutesToPixels } from '../../../utils/timeUtils';

interface EventsLayerProps {
    days: Date[];
    timedEvents: NekoEvent[];
    columnCount: number;
    hourHeight: number;
    dayStartMinutes: number;
    toggleTask: (id: string) => void;

    // Drag state for Ghost Event
    isDragging: boolean;
    dragStart: { dayIndex: number; minutes: number } | null;
    dragEnd: { minutes: number } | null;

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
    toggleTask,
    isDragging,
    dragStart,
    dragEnd,
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

                if (isCreatingOnThisDay) {
                    const actualStartMin = Math.min(dragStart!.minutes, dragEnd!.minutes);
                    const actualEndMin = Math.max(dragStart!.minutes, dragEnd!.minutes);

                    // Check if the drag spans across the dayStartMinutes boundary
                    const startBeforeDayStart = actualStartMin < dayStartMinutes;
                    const endBeforeDayStart = actualEndMin < dayStartMinutes;

                    // If drag spans across day boundary, don't show ghost (invalid selection)
                    if (startBeforeDayStart && !endBeforeDayStart) {
                        layoutMap = calculateEventLayout(layoutEvents);
                    } else {
                        // Calculate ghost event times considering visual day
                        let ghostStartDate: Date;
                        let ghostEndDate: Date;

                        if (startBeforeDayStart) {
                            ghostStartDate = new Date(day);
                            ghostStartDate.setDate(ghostStartDate.getDate() + 1);
                            ghostStartDate.setHours(Math.floor(actualStartMin / 60), actualStartMin % 60, 0, 0);
                        } else {
                            ghostStartDate = new Date(day);
                            ghostStartDate.setHours(Math.floor(actualStartMin / 60), actualStartMin % 60, 0, 0);
                        }

                        if (endBeforeDayStart) {
                            ghostEndDate = new Date(day);
                            ghostEndDate.setDate(ghostEndDate.getDate() + 1);
                            ghostEndDate.setHours(Math.floor(actualEndMin / 60), actualEndMin % 60, 0, 0);
                        } else {
                            ghostEndDate = new Date(day);
                            ghostEndDate.setHours(Math.floor(actualEndMin / 60), actualEndMin % 60, 0, 0);
                        }

                        const ghostStartTime = ghostStartDate.getTime();
                        const ghostEndTime = ghostEndDate.getTime();

                        const hasOverlap = layoutEvents.some(event =>
                            event.startDate < ghostEndTime && event.endDate > ghostStartTime
                        );

                        if (hasOverlap) {
                            const ghostEvent = {
                                id: '__ghost__',
                                startDate: ghostStartTime,
                                endDate: ghostEndTime,
                                color: 'blue' as const,
                                completed: false, // Ghost is always incomplete
                            };
                            layoutMap = calculateEventLayout([...layoutEvents, ghostEvent]);
                            ghostLayout = layoutMap.get('__ghost__');
                        } else {
                            layoutMap = calculateEventLayout(layoutEvents);
                            ghostLayout = { id: '__ghost__', column: 0, totalColumns: 1, leftPercent: 0, widthPercent: 100 };
                        }
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
                                    onToggle={toggleTask}
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
                                    top: `${minutesToPixels(Math.min(dragStart!.minutes, dragEnd!.minutes), hourHeight, dayStartMinutes)}px`,
                                    height: `${(Math.abs(dragEnd!.minutes - dragStart!.minutes) / 60) * hourHeight}px`,
                                    left: `${ghostLayout.leftPercent}%`,
                                    width: `${ghostLayout.widthPercent}%`,
                                }}
                                className="z-30 bg-zinc-400/20 border-2 border-zinc-400 rounded-md pointer-events-none"
                            />
                        )}
                    </div>
                );
            })}
        </div>
    );
}
