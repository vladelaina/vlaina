/**
 * ICS Types - NekoTick calendar event types
 * 
 * These types represent calendar events in NekoTick's internal format.
 * They can be converted to/from standard ICS (iCalendar) format.
 */

import type { ItemColor } from '@/lib/colors';

/**
 * NekoEvent - Internal calendar event representation
 * 
 * Maps to ICS VEVENT with custom X-NEKO-* extensions
 */
export interface NekoEvent {
    /** Unique identifier (maps to ICS UID) */
    uid: string;

    /** Event title (maps to ICS SUMMARY) */
    summary: string;

    /** Event start time */
    dtstart: Date;

    /** Event end time */
    dtend: Date;

    /** Whether this is an all-day event */
    allDay: boolean;

    /** Event description (maps to ICS DESCRIPTION) */
    description?: string;

    /** Event location (maps to ICS LOCATION) */
    location?: string;

    // --- NekoTick Extensions (stored as X-NEKO-* properties) ---

    /** Calendar ID this event belongs to */
    calendarId: string;

    /** Event color */
    color?: ItemColor;

    /** Event icon (emoji or icon name) */
    icon?: string;

    /** Timer state for time-tracking */
    timerState?: 'idle' | 'running' | 'paused';

    /** Timer started timestamp */
    timerStartedAt?: number;

    /** Accumulated timer duration in ms */
    timerAccumulated?: number;

    /** Whether this event is completed/done */
    completed?: boolean;
}

/**
 * NekoCalendar - A calendar container
 */
export interface NekoCalendar {
    /** Calendar ID (also used as filename) */
    id: string;

    /** Display name */
    name: string;

    /** Default color for events */
    color: ItemColor;

    /** Whether to show this calendar in view */
    visible: boolean;
}

/**
 * X-Property names for NekoTick extensions
 */
export const NEKO_X_PROPS = {
    COLOR: 'X-NEKO-COLOR',
    ICON: 'X-NEKO-ICON',
    CALENDAR_ID: 'X-NEKO-CALENDAR-ID',
    TIMER_STATE: 'X-NEKO-TIMER-STATE',
    TIMER_STARTED: 'X-NEKO-TIMER-STARTED',
    TIMER_ACCUMULATED: 'X-NEKO-TIMER-ACCUMULATED',
    COMPLETED: 'X-NEKO-COMPLETED',
} as const;
