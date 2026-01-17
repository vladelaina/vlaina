import React from 'react';
import { displayPositionToHour, minutesToPixels, CALENDAR_CONSTANTS } from '../../../utils/timeUtils';

const GUTTER_WIDTH = CALENDAR_CONSTANTS.GUTTER_WIDTH as number;

interface TimeColumnProps {
    hourHeight: number;
    dayStartMinutes: number;
    use24Hour: boolean;
    dragTimeIndicator: { startMinutes: number; endMinutes: number } | null;
    hoverTimeIndicator: { startMinutes: number; endMinutes: number } | null;
}

export function TimeColumn({
    hourHeight,
    dayStartMinutes,
    use24Hour,
    dragTimeIndicator,
    hoverTimeIndicator,
}: TimeColumnProps) {
    return (
        <div style={{ width: GUTTER_WIDTH }} className="flex-shrink-0 sticky left-0 z-10 bg-white dark:bg-zinc-950">
            {Array.from({ length: 24 }).map((_, displayPos) => {
                const actualHour = displayPositionToHour(displayPos, dayStartMinutes);
                return (
                    <div key={displayPos} style={{ height: hourHeight }} className="relative">
                        {displayPos !== 0 && (
                            <span className="absolute -top-2 right-3 text-[11px] text-zinc-400 dark:text-zinc-500 font-medium tabular-nums">
                                {use24Hour
                                    ? `${actualHour}:00`
                                    : actualHour === 0 ? '12AM'
                                        : actualHour < 12 ? `${actualHour}AM`
                                            : actualHour === 12 ? '12PM'
                                                : `${actualHour - 12}PM`
                                }
                            </span>
                        )}
                    </div>
                );
            })}

            {/* Drag time indicators */}
            {dragTimeIndicator && (
                <>
                    {/* Start time indicator */}
                    {dragTimeIndicator.startMinutes % 60 !== 0 && (
                        <div
                            className="absolute z-20 pointer-events-none"
                            style={{
                                top: `${minutesToPixels(dragTimeIndicator.startMinutes, hourHeight, dayStartMinutes)}px`,
                                right: 12,
                                transform: 'translateY(-50%)',
                            }}
                        >
                            <span className="text-[11px] text-zinc-400 dark:text-zinc-500 font-medium tabular-nums">
                                :{String(dragTimeIndicator.startMinutes % 60).padStart(2, '0')}
                            </span>
                        </div>
                    )}
                    {/* End time indicator */}
                    {dragTimeIndicator.endMinutes % 60 !== 0 && (
                        <div
                            className="absolute z-20 pointer-events-none"
                            style={{
                                top: `${minutesToPixels(dragTimeIndicator.endMinutes, hourHeight, dayStartMinutes)}px`,
                                right: 12,
                                transform: 'translateY(-50%)',
                            }}
                        >
                            <span className="text-[11px] text-zinc-400 dark:text-zinc-500 font-medium tabular-nums">
                                :{String(dragTimeIndicator.endMinutes % 60).padStart(2, '0')}
                            </span>
                        </div>
                    )}
                </>
            )}

            {/* Hover time indicator */}
            {hoverTimeIndicator && !dragTimeIndicator && (
                <>
                    {/* Start time indicator */}
                    {hoverTimeIndicator.startMinutes % 60 !== 0 && (
                        <div
                            className="absolute z-20 pointer-events-none transition-all duration-75"
                            style={{
                                top: `${minutesToPixels(hoverTimeIndicator.startMinutes, hourHeight, dayStartMinutes)}px`,
                                right: 12,
                                transform: 'translateY(-50%)',
                            }}
                        >
                            <span className="text-[11px] text-zinc-400/70 dark:text-zinc-500/70 font-medium tabular-nums">
                                :{String(hoverTimeIndicator.startMinutes % 60).padStart(2, '0')}
                            </span>
                        </div>
                    )}
                    {/* End time indicator */}
                    {hoverTimeIndicator.endMinutes % 60 !== 0 && (
                        <div
                            className="absolute z-20 pointer-events-none transition-all duration-75"
                            style={{
                                top: `${minutesToPixels(hoverTimeIndicator.endMinutes, hourHeight, dayStartMinutes)}px`,
                                right: 12,
                                transform: 'translateY(-50%)',
                            }}
                        >
                            <span className="text-[11px] text-zinc-400/70 dark:text-zinc-500/70 font-medium tabular-nums">
                                :{String(hoverTimeIndicator.endMinutes % 60).padStart(2, '0')}
                            </span>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
