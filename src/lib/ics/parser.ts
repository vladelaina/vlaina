/**
 * ICS Parser - Parse ICS files to NekoEvent objects
 */

import ICAL from 'ical.js';
import type { NekoEvent } from './types';
import type { ItemColor } from '@/lib/colors';
import { NEKO_X_PROPS } from './types';

/**
 * Parse an ICS string into NekoEvent array
 */
export function parseICS(icsContent: string, defaultCalendarId: string = 'default'): NekoEvent[] {
    const jcalData = ICAL.parse(icsContent);
    const comp = new ICAL.Component(jcalData);
    const vevents = comp.getAllSubcomponents('vevent');

    const events: NekoEvent[] = [];

    for (const vevent of vevents) {
        const event = new ICAL.Event(vevent);

        // Get standard properties
        const dtstart = event.startDate;
        const dtend = event.endDate;

        if (!dtstart) continue; // Skip invalid events

        // Get NekoTick custom properties
        const nekoColor = vevent.getFirstPropertyValue(NEKO_X_PROPS.COLOR) as ItemColor | null;
        const nekoIcon = vevent.getFirstPropertyValue(NEKO_X_PROPS.ICON) as string | null;
        const nekoIconSize = vevent.getFirstPropertyValue(NEKO_X_PROPS.ICON_SIZE) as string | null;
        const nekoCalendarId = vevent.getFirstPropertyValue(NEKO_X_PROPS.CALENDAR_ID) as string | null;
        const nekoTimerState = vevent.getFirstPropertyValue(NEKO_X_PROPS.TIMER_STATE) as 'idle' | 'running' | 'paused' | null;
        const nekoTimerStarted = vevent.getFirstPropertyValue(NEKO_X_PROPS.TIMER_STARTED) as string | null;
        const nekoTimerAccumulated = vevent.getFirstPropertyValue(NEKO_X_PROPS.TIMER_ACCUMULATED) as string | null;
        const nekoCompleted = vevent.getFirstPropertyValue(NEKO_X_PROPS.COMPLETED) as string | null;

        const nekoEvent: NekoEvent = {
            uid: event.uid || crypto.randomUUID(),
            summary: event.summary || '',
            dtstart: dtstart.toJSDate(),
            dtend: dtend ? dtend.toJSDate() : new Date(dtstart.toJSDate().getTime() + 30 * 60 * 1000), // Default 30 min
            allDay: dtstart.isDate,
            description: event.description || undefined,
            location: event.location || undefined,
            calendarId: nekoCalendarId || defaultCalendarId,
            color: nekoColor || undefined,
            icon: nekoIcon || undefined,
            iconSize: nekoIconSize ? parseInt(nekoIconSize, 10) : undefined,
            timerState: nekoTimerState || undefined,
            timerStartedAt: nekoTimerStarted ? parseInt(nekoTimerStarted, 10) : undefined,
            timerAccumulated: nekoTimerAccumulated ? parseInt(nekoTimerAccumulated, 10) : undefined,
            completed: nekoCompleted === 'TRUE',
        };

        events.push(nekoEvent);
    }

    return events;
}

/**
 * Parse multiple ICS files into a combined event list
 */
export function parseMultipleICS(
    icsFiles: Array<{ calendarId: string; content: string }>
): NekoEvent[] {
    const allEvents: NekoEvent[] = [];

    for (const file of icsFiles) {
        const events = parseICS(file.content, file.calendarId);
        allEvents.push(...events);
    }

    return allEvents;
}
