/**
 * ICS Generator - Generate ICS files from NekoEvent objects
 */

import ical, { ICalEventData } from 'ical-generator';
import type { NekoEvent, NekoCalendar } from './types';
import { NEKO_X_PROPS } from './types';

/**
 * Generate an ICS string from NekoEvent array
 */
export function generateICS(events: NekoEvent[], calendar: NekoCalendar): string {
    const cal = ical({
        name: calendar.name,
        prodId: { company: 'NekoTick', product: 'Calendar', language: 'EN' },
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });

    for (const event of events) {
        // Filter events for this calendar
        if (event.calendarId !== calendar.id) continue;

        const eventData: ICalEventData = {
            id: event.uid,
            start: event.dtstart,
            end: event.dtend,
            summary: event.summary,
            description: event.description,
            location: event.location,
            allDay: event.allDay,
        };

        const calEvent = cal.createEvent(eventData);

        // Add NekoTick custom X-properties
        const xProps: Array<{ key: string; value: string }> = [];

        xProps.push({ key: NEKO_X_PROPS.CALENDAR_ID, value: event.calendarId });

        if (event.color) {
            xProps.push({ key: NEKO_X_PROPS.COLOR, value: event.color });
        }

        if (event.icon) {
            xProps.push({ key: NEKO_X_PROPS.ICON, value: encodeURIComponent(event.icon) });
        }

        if (event.iconSize) {
            xProps.push({ key: NEKO_X_PROPS.ICON_SIZE, value: String(event.iconSize) });
        }

        if (event.timerState) {
            xProps.push({ key: NEKO_X_PROPS.TIMER_STATE, value: event.timerState });
        }

        if (event.timerStartedAt !== undefined) {
            xProps.push({ key: NEKO_X_PROPS.TIMER_STARTED, value: String(event.timerStartedAt) });
        }

        if (event.timerAccumulated !== undefined) {
            xProps.push({ key: NEKO_X_PROPS.TIMER_ACCUMULATED, value: String(event.timerAccumulated) });
        }

        if (event.completed) {
            xProps.push({ key: NEKO_X_PROPS.COMPLETED, value: 'TRUE' });
        }

        // Add all X-properties
        if (xProps.length > 0) {
            calEvent.x(xProps);
        }
    }

    return cal.toString();
}

/**
 * Generate multiple ICS files, one per calendar
 */
export function generateMultipleICS(
    events: NekoEvent[],
    calendars: NekoCalendar[]
): Map<string, string> {
    const icsFiles = new Map<string, string>();

    for (const calendar of calendars) {
        const calendarEvents = events.filter(e => e.calendarId === calendar.id);
        const icsContent = generateICS(calendarEvents, calendar);
        icsFiles.set(calendar.id, icsContent);
    }

    return icsFiles;
}
