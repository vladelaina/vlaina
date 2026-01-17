/**
 * Calendar Storage - ICS-based calendar storage
 * 
 * Handles reading and writing calendar events to .ics files.
 * Each calendar is stored as a separate .ics file in .nekotick/calendars/
 */

import { getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import { parseICS } from '@/lib/ics/parser';
import { generateICS } from '@/lib/ics/generator';
import type { NekoEvent, NekoCalendar } from '@/lib/ics/types';
import type { ItemColor } from '@/lib/colors';

const CALENDARS_DIR = 'calendars';
const CALENDARS_META_FILE = 'calendars.json';

let basePath: string | null = null;

async function getBasePath(): Promise<string> {
    if (basePath === null) {
        const storage = getStorageAdapter();
        const appData = await storage.getBasePath();
        basePath = appData.endsWith('\\') || appData.endsWith('/')
            ? appData.slice(0, -1)
            : appData;
    }
    return basePath;
}

async function getCalendarsDir(): Promise<string> {
    const base = await getBasePath();
    return joinPath(base, '.nekotick', CALENDARS_DIR);
}

async function getCalendarsMetaPath(): Promise<string> {
    const base = await getBasePath();
    return joinPath(base, '.nekotick', CALENDARS_META_FILE);
}

async function ensureCalendarsDir(): Promise<void> {
    const storage = getStorageAdapter();
    const dir = await getCalendarsDir();
    if (!(await storage.exists(dir))) {
        await storage.mkdir(dir, true);
    }
}

/**
 * Default calendar when none exists
 */
function getDefaultCalendar(): NekoCalendar {
    return {
        id: 'personal',
        name: '個人',
        color: 'blue',
        visible: true,
    };
}

/**
 * Load calendar metadata (list of calendars)
 */
export async function loadCalendarsMeta(): Promise<NekoCalendar[]> {
    try {
        const storage = getStorageAdapter();
        const metaPath = await getCalendarsMetaPath();

        if (await storage.exists(metaPath)) {
            const content = await storage.readFile(metaPath);
            const parsed = JSON.parse(content) as { calendars: NekoCalendar[] };
            if (parsed.calendars && parsed.calendars.length > 0) {
                return parsed.calendars;
            }
        }

        // Return default calendar if no metadata exists
        return [getDefaultCalendar()];
    } catch (error) {
        console.error('[CalendarStorage] Failed to load calendars meta:', error);
        return [getDefaultCalendar()];
    }
}

/**
 * Save calendar metadata
 */
export async function saveCalendarsMeta(calendars: NekoCalendar[]): Promise<void> {
    try {
        const storage = getStorageAdapter();
        await ensureCalendarsDir();
        const metaPath = await getCalendarsMetaPath();

        await storage.writeFile(metaPath, JSON.stringify({ calendars }, null, 2));
        // Log removed
    } catch (error) {
        console.error('[CalendarStorage] Failed to save calendars meta:', error);
    }
}

/**
 * Load all events from all calendar ICS files
 */
export async function loadAllEvents(): Promise<NekoEvent[]> {
    try {
        const storage = getStorageAdapter();
        await ensureCalendarsDir();
        const calendarsDir = await getCalendarsDir();
        const calendars = await loadCalendarsMeta();

        const allEvents: NekoEvent[] = [];

        for (const calendar of calendars) {
            const icsPath = await joinPath(calendarsDir, `${calendar.id}.ics`);

            if (await storage.exists(icsPath)) {
                const content = await storage.readFile(icsPath);
                const events = parseICS(content, calendar.id);

                // Apply calendar's default color to events without color
                for (const event of events) {
                    if (!event.color) {
                        event.color = calendar.color;
                    }
                }

                allEvents.push(...events);
            }
        }

        // Log removed
        return allEvents;
    } catch (error) {
        console.error('[CalendarStorage] Failed to load events:', error);
        return [];
    }
}

/**
 * Save events to their respective calendar ICS files
 */
export async function saveAllEvents(events: NekoEvent[], calendars: NekoCalendar[]): Promise<void> {
    try {
        const storage = getStorageAdapter();
        await ensureCalendarsDir();
        const calendarsDir = await getCalendarsDir();

        // Group events by calendar
        const eventsByCalendar = new Map<string, NekoEvent[]>();
        for (const calendar of calendars) {
            eventsByCalendar.set(calendar.id, []);
        }

        for (const event of events) {
            const calendarEvents = eventsByCalendar.get(event.calendarId);
            if (calendarEvents) {
                calendarEvents.push(event);
            } else {
                // Event belongs to unknown calendar, add to first calendar
                const firstCalendar = calendars[0];
                if (firstCalendar) {
                    event.calendarId = firstCalendar.id;
                    eventsByCalendar.get(firstCalendar.id)?.push(event);
                }
            }
        }

        // Write each calendar's ICS file
        for (const calendar of calendars) {
            const calendarEvents = eventsByCalendar.get(calendar.id) || [];
            const icsContent = generateICS(calendarEvents, calendar);
            const icsPath = await joinPath(calendarsDir, `${calendar.id}.ics`);
            await storage.writeFile(icsPath, icsContent);
        }

        // Log removed
    } catch (error) {
        console.error('[CalendarStorage] Failed to save events:', error);
    }
}

/**
 * Add a new calendar
 */
export async function addCalendar(name: string, color: ItemColor): Promise<NekoCalendar> {
    const calendars = await loadCalendarsMeta();

    const newCalendar: NekoCalendar = {
        id: `cal_${Date.now()}`,
        name,
        color,
        visible: true,
    };

    calendars.push(newCalendar);
    await saveCalendarsMeta(calendars);

    // Create empty ICS file
    const storage = getStorageAdapter();
    const calendarsDir = await getCalendarsDir();
    const icsPath = await joinPath(calendarsDir, `${newCalendar.id}.ics`);
    const emptyIcs = generateICS([], newCalendar);
    await storage.writeFile(icsPath, emptyIcs);

    return newCalendar;
}

/**
 * Delete a calendar and its events
 */
export async function deleteCalendar(calendarId: string): Promise<void> {
    const calendars = await loadCalendarsMeta();
    const filtered = calendars.filter(c => c.id !== calendarId);

    if (filtered.length === 0) {
        // Don't delete the last calendar
        throw new Error('Cannot delete the last calendar');
    }

    await saveCalendarsMeta(filtered);

    // Delete the ICS file
    const storage = getStorageAdapter();
    const calendarsDir = await getCalendarsDir();
    const icsPath = await joinPath(calendarsDir, `${calendarId}.ics`);

    if (await storage.exists(icsPath)) {
        await storage.deleteFile(icsPath);
    }
}

/**
 * Update a calendar's metadata
 */
export async function updateCalendar(
    calendarId: string,
    updates: Partial<Pick<NekoCalendar, 'name' | 'color' | 'visible'>>
): Promise<void> {
    const calendars = await loadCalendarsMeta();
    const index = calendars.findIndex(c => c.id === calendarId);

    if (index === -1) {
        throw new Error(`Calendar not found: ${calendarId}`);
    }

    calendars[index] = { ...calendars[index], ...updates };
    await saveCalendarsMeta(calendars);
}
