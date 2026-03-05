import ICAL from 'ical.js';
import type { NekoEvent } from './types';
import type { ItemColor } from '@/lib/colors';
import { NEKO_X_PROPS } from './types';
import { deserializeTags } from '@/lib/tags/tagUtils';

function isMidnight(date: Date): boolean {
    return date.getHours() === 0
        && date.getMinutes() === 0
        && date.getSeconds() === 0
        && date.getMilliseconds() === 0;
}

export function parseICS(icsContent: string, defaultCalendarId: string = 'default'): NekoEvent[] {
    const jcalData = ICAL.parse(icsContent);
    const comp = new ICAL.Component(jcalData);
    const vevents = comp.getAllSubcomponents('vevent');

    const events: NekoEvent[] = [];

    for (const vevent of vevents) {
        const event = new ICAL.Event(vevent);

        const dtstart = event.startDate;
        const dtend = event.endDate;

        if (!dtstart) continue;

        const nekoColor = vevent.getFirstPropertyValue(NEKO_X_PROPS.COLOR.toLowerCase()) as ItemColor | null;
        let nekoIcon = vevent.getFirstPropertyValue(NEKO_X_PROPS.ICON.toLowerCase()) as string | null;
        
        if (nekoIcon) {
            try {
                nekoIcon = decodeURIComponent(nekoIcon);
            } catch (e) {
            }
        }
        const nekoIconSize = vevent.getFirstPropertyValue(NEKO_X_PROPS.ICON_SIZE.toLowerCase()) as string | null;
        const nekoCalendarId = vevent.getFirstPropertyValue(NEKO_X_PROPS.CALENDAR_ID.toLowerCase()) as string | null;
        const nekoTimerState = vevent.getFirstPropertyValue(NEKO_X_PROPS.TIMER_STATE.toLowerCase()) as 'idle' | 'running' | 'paused' | null;
        const nekoTimerStarted = vevent.getFirstPropertyValue(NEKO_X_PROPS.TIMER_STARTED.toLowerCase()) as string | null;
        const nekoTimerAccumulated = vevent.getFirstPropertyValue(NEKO_X_PROPS.TIMER_ACCUMULATED.toLowerCase()) as string | null;
        const nekoCompleted = vevent.getFirstPropertyValue(NEKO_X_PROPS.COMPLETED.toLowerCase()) as string | null;
        const nekoOriginalDtStart = vevent.getFirstPropertyValue(NEKO_X_PROPS.ORIGINAL_DTSTART.toLowerCase()) as string | null;
        const nekoOriginalDtEnd = vevent.getFirstPropertyValue(NEKO_X_PROPS.ORIGINAL_DTEND.toLowerCase()) as string | null;
        const nekoGroupId = vevent.getFirstPropertyValue(NEKO_X_PROPS.GROUP_ID.toLowerCase()) as string | null;
        const nekoOrder = vevent.getFirstPropertyValue(NEKO_X_PROPS.ORDER.toLowerCase()) as string | null;
        const nekoParentId = vevent.getFirstPropertyValue(NEKO_X_PROPS.PARENT_ID.toLowerCase()) as string | null;
        const nekoCollapsed = vevent.getFirstPropertyValue(NEKO_X_PROPS.COLLAPSED.toLowerCase()) as string | null;
        const nekoEstimatedMinutes = vevent.getFirstPropertyValue(NEKO_X_PROPS.ESTIMATED_MINUTES.toLowerCase()) as string | null;
        const nekoTags = vevent.getFirstPropertyValue(NEKO_X_PROPS.TAGS.toLowerCase()) as string | null;

        const startDate = dtstart.toJSDate();
        let endDate: Date;

        if (dtend) {
            const parsedEnd = dtend.toJSDate();
            // RFC 5545 all-day events are end-exclusive; normalize to inclusive end.
            if (dtstart.isDate && isMidnight(parsedEnd) && parsedEnd.getTime() > startDate.getTime()) {
                endDate = new Date(parsedEnd.getTime() - 1);
            } else {
                endDate = parsedEnd;
            }
        } else if (dtstart.isDate) {
            endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000 - 1);
        } else {
            endDate = new Date(startDate.getTime() + 30 * 60 * 1000);
        }

        const nekoEvent: NekoEvent = {
            uid: event.uid || crypto.randomUUID(),
            summary: event.summary || '',
            dtstart: startDate,
            dtend: endDate,
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
            originalDtStart: nekoOriginalDtStart ? parseInt(nekoOriginalDtStart, 10) : undefined,
            originalDtEnd: nekoOriginalDtEnd ? parseInt(nekoOriginalDtEnd, 10) : undefined,
            groupId: nekoGroupId || undefined,
            order: nekoOrder ? parseFloat(nekoOrder) : undefined,
            parentId: nekoParentId || undefined,
            collapsed: nekoCollapsed === 'TRUE',
            estimatedMinutes: nekoEstimatedMinutes ? parseInt(nekoEstimatedMinutes, 10) : undefined,
            tags: deserializeTags(nekoTags),
        };

        events.push(nekoEvent);

    }

    return events;
}

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
