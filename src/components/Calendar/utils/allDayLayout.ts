/**
 * All-Day Event Layout Algorithm
 * 
 * Calculates the optimal layout for all-day events displayed at the top of
 * the calendar grid. Handles overlapping events across multiple days.
 */

import { startOfDay, differenceInDays } from 'date-fns';
import type { NekoEvent } from '@/lib/ics/types';
import { getColorPriority } from '@/lib/colors';

// -------------------------------------------------------------------------
// Constants
// -------------------------------------------------------------------------

export const ALL_DAY_CONSTANTS = {
    MAX_VISIBLE_ROWS: 3,
    EVENT_HEIGHT: 22,
    EVENT_GAP: 2,
    MIN_AREA_HEIGHT: 28,
    COLLAPSED_HEIGHT: 28,
} as const;

// -------------------------------------------------------------------------
// Types
// -------------------------------------------------------------------------

export interface LayoutedEvent {
    event: NekoEvent;
    row: number;
    startCol: number;
    endCol: number;
}

export interface AllDayLayoutResult {
    layoutedEvents: LayoutedEvent[];
    totalRows: number;
    overflowByDay: Map<number, number>;
}

// -------------------------------------------------------------------------
// Algorithm
// -------------------------------------------------------------------------

/**
 * Calculate layout positions for all-day events.
 * 
 * Algorithm:
 * 1. Sort events by color priority, duration (longer first), then start date
 * 2. For each event, find the first available row where all needed columns are free
 * 3. Mark those columns as occupied in that row
 * 4. Track overflow count per day for "show more" indicators
 */
export function calculateAllDayLayout(
    events: NekoEvent[],
    days: Date[]
): AllDayLayoutResult {
    if (events.length === 0 || days.length === 0) {
        return { layoutedEvents: [], totalRows: 0, overflowByDay: new Map() };
    }

    const firstDay = startOfDay(days[0]);

    // Sort events: by color priority first, then longer events, then by start date
    const sortedEvents = [...events].sort((a, b) => {
        // First by color priority
        const colorOrderA = getColorPriority(a.color);
        const colorOrderB = getColorPriority(b.color);
        if (colorOrderA !== colorOrderB) return colorOrderA - colorOrderB;

        // Then by duration (longer first)
        const durationA = a.dtend.getTime() - a.dtstart.getTime();
        const durationB = b.dtend.getTime() - b.dtstart.getTime();
        if (durationA !== durationB) return durationB - durationA;

        // Finally by start date
        return a.dtstart.getTime() - b.dtstart.getTime();
    });

    const layoutedEvents: LayoutedEvent[] = [];
    const rowOccupancy: boolean[][] = []; // rowOccupancy[row][col] = occupied

    for (const event of sortedEvents) {
        const eventStart = startOfDay(event.dtstart);
        const eventEnd = startOfDay(event.dtend);

        // Calculate column range (clipped to visible days)
        const startCol = Math.max(0, differenceInDays(eventStart, firstDay));
        const endCol = Math.min(days.length - 1, differenceInDays(eventEnd, firstDay));

        // Skip if completely outside visible range
        if (startCol > days.length - 1 || endCol < 0) continue;

        // Find first available row
        let row = 0;
        while (true) {
            if (!rowOccupancy[row]) {
                rowOccupancy[row] = new Array(days.length).fill(false);
            }

            let canFit = true;
            for (let col = startCol; col <= endCol; col++) {
                if (rowOccupancy[row][col]) {
                    canFit = false;
                    break;
                }
            }

            if (canFit) break;
            row++;
        }

        // Mark columns as occupied
        for (let col = startCol; col <= endCol; col++) {
            if (!rowOccupancy[row]) {
                rowOccupancy[row] = new Array(days.length).fill(false);
            }
            rowOccupancy[row][col] = true;
        }

        layoutedEvents.push({
            event,
            row,
            startCol,
            endCol,
        });
    }

    // Calculate overflow for each day
    const overflowByDay = new Map<number, number>();
    for (let col = 0; col < days.length; col++) {
        let eventsInCol = 0;
        for (const le of layoutedEvents) {
            if (le.startCol <= col && le.endCol >= col) {
                eventsInCol++;
            }
        }
        if (eventsInCol > ALL_DAY_CONSTANTS.MAX_VISIBLE_ROWS) {
            overflowByDay.set(col, eventsInCol - ALL_DAY_CONSTANTS.MAX_VISIBLE_ROWS);
        }
    }

    return {
        layoutedEvents,
        totalRows: rowOccupancy.length,
        overflowByDay,
    };
}
