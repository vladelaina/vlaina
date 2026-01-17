import React from 'react';
import { format } from 'date-fns';
import { CALENDAR_CONSTANTS } from '../../../utils/timeUtils';

const GUTTER_WIDTH = CALENDAR_CONSTANTS.GUTTER_WIDTH as number;

interface CurrentTimeLineProps {
    nowTop: number;
    use24Hour: boolean;
    now: Date;
}

export function CurrentTimeLine({ nowTop, use24Hour, now }: CurrentTimeLineProps) {
    return (
        <div style={{ top: nowTop }} className="absolute left-0 right-0 z-20 flex items-center pointer-events-none">
            <div className="absolute flex items-center" style={{ left: -GUTTER_WIDTH }}>
                <span className="bg-red-500 text-white text-[11px] font-medium px-1.5 py-0.5 rounded">
                    {use24Hour ? format(now, 'H:mm') : format(now, 'h:mma').toUpperCase()}
                </span>
            </div>
            <div className="h-[2px] w-full bg-red-500" />
        </div>
    );
}
