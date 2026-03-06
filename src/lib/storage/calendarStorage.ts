import { getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import { parseICS } from '@/lib/ics/parser';
import { generateICS } from '@/lib/ics/generator';
import type { NekoEvent, NekoCalendar } from '@/lib/ics/types';
import type { ItemColor } from '@/lib/colors';
import { loadUnifiedData, saveUnifiedDataImmediate } from './unifiedStorage';

const CALENDARS_DIR = 'calendars';
const DEFAULT_CALENDAR: NekoCalendar = { id: 'main', name: 'Main', color: 'blue', visible: true };

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

async function ensureCalendarsDir(): Promise<void> {
    const storage = getStorageAdapter();
    const dir = await getCalendarsDir();
    if (!(await storage.exists(dir))) {
        await storage.mkdir(dir, true);
    }
}

export async function loadCalendarsMeta(): Promise<NekoCalendar[]> {
    const data = await loadUnifiedData();
    return data.calendars || [];
}

export async function saveCalendarsMeta(calendars: NekoCalendar[]): Promise<void> {
    const data = await loadUnifiedData();
    await saveUnifiedDataImmediate({
        ...data,
        calendars
    });
}

async function resolveCalendarsForSave(calendars: NekoCalendar[]): Promise<NekoCalendar[]> {
    if (calendars.length > 0) return calendars;

    const storedCalendars = await loadCalendarsMeta();
    if (storedCalendars.length > 0) {
        await saveCalendarsMeta(storedCalendars);
        return storedCalendars;
    }

    const fallbackCalendars = [{ ...DEFAULT_CALENDAR }];
    await saveCalendarsMeta(fallbackCalendars);
    return fallbackCalendars;
}

async function writeCalendarIcsIfChanged(path: string, content: string): Promise<void> {
    const storage = getStorageAdapter();
    const exists = await storage.exists(path);
    if (exists) {
        try {
            const currentContent = await storage.readFile(path);
            if (currentContent === content) {
                return;
            }
        } catch {
            // Fall through to overwrite on read error.
        }
    }
    await storage.writeFile(path, content);
}

let saveAllEventsQueue: Promise<void> = Promise.resolve();

function enqueueSaveAllEvents(task: () => Promise<void>): Promise<void> {
    const run = saveAllEventsQueue.then(task);
    saveAllEventsQueue = run.catch(() => {
        // Keep queue alive after errors.
    });
    return run;
}

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
                
                const cleanContent = content.replace(/\r/g, '');
                const events = parseICS(cleanContent, calendar.id);

                for (const event of events) {
                    if (!event.color) {
                        event.color = calendar.color;
                    }
                }

                allEvents.push(...events);
            }
        }

        return allEvents;
    } catch (error) {
        console.error('[CalendarStorage] Failed to load calendar events:', error);
        return [];
    }
}

async function performSaveAllEvents(events: NekoEvent[], calendars: NekoCalendar[]): Promise<void> {
    const normalizedCalendars = await resolveCalendarsForSave(calendars);
    await ensureCalendarsDir();
    const calendarsDir = await getCalendarsDir();

    const eventsByCalendar = new Map<string, NekoEvent[]>();
    for (const calendar of normalizedCalendars) {
        eventsByCalendar.set(calendar.id, []);
    }

    for (const event of events) {
        const calendarEvents = eventsByCalendar.get(event.calendarId);
        if (calendarEvents) {
            calendarEvents.push(event);
        } else {
            const firstCalendar = normalizedCalendars[0];
            if (firstCalendar) {
                eventsByCalendar.get(firstCalendar.id)?.push({
                    ...event,
                    calendarId: firstCalendar.id,
                });
            }
        }
    }

    for (const calendar of normalizedCalendars) {
        const calendarEvents = eventsByCalendar.get(calendar.id) || [];
        const icsContent = generateICS(calendarEvents, calendar);
        const icsPath = await joinPath(calendarsDir, `${calendar.id}.ics`);
        await writeCalendarIcsIfChanged(icsPath, icsContent);
    }
}

export async function saveAllEvents(events: NekoEvent[], calendars: NekoCalendar[]): Promise<void> {
    const eventsSnapshot = events.map((event) => ({ ...event }));
    const calendarsSnapshot = calendars.map((calendar) => ({ ...calendar }));
    return enqueueSaveAllEvents(() => performSaveAllEvents(eventsSnapshot, calendarsSnapshot));
}

export async function addCalendar(name: string, color: ItemColor): Promise<NekoCalendar> {
    const calendars = await loadCalendarsMeta();

    const newCalendar: NekoCalendar = {
        id: `cal_${Date.now()}`,
        name,
        color,
        visible: true,
    };

    const storage = getStorageAdapter();
    await ensureCalendarsDir();
    const calendarsDir = await getCalendarsDir();
    const icsPath = await joinPath(calendarsDir, `${newCalendar.id}.ics`);
    const emptyIcs = generateICS([], newCalendar);
    await storage.writeFile(icsPath, emptyIcs);

    try {
        await saveCalendarsMeta([...calendars, newCalendar]);
    } catch (error) {
        try {
            await storage.deleteFile(icsPath);
        } catch {
            // Cleanup best-effort only.
        }
        throw error;
    }

    return newCalendar;
}

export async function deleteCalendar(calendarId: string): Promise<void> {
    const calendars = await loadCalendarsMeta();
    const filtered = calendars.filter(c => c.id !== calendarId);

    if (filtered.length === 0) {
        throw new Error('Cannot delete the last calendar');
    }

    await saveCalendarsMeta(filtered);

    const storage = getStorageAdapter();
    const calendarsDir = await getCalendarsDir();
    const icsPath = await joinPath(calendarsDir, `${calendarId}.ics`);

    if (await storage.exists(icsPath)) {
        await storage.deleteFile(icsPath);
    }
}

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
