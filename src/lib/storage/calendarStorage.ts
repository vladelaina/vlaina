import { getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import type { NekoEvent, NekoCalendar } from '@/lib/ics/types';
import type { ItemColor } from '@/lib/colors';

const CALENDAR_ROOT_DIR = 'calendar';
const CALENDAR_EVENTS_DIR = 'events';
const CALENDAR_META_FILE = 'meta.json';
const STORAGE_SCHEMA_VERSION = 1;
const DEFAULT_EVENT_DURATION_MS = 30 * 60 * 1000;

interface CalendarMetaFile {
    schemaVersion: number;
    updatedAt: number;
    calendars: NekoCalendar[];
}

interface PersistedEvent extends Omit<NekoEvent, 'dtstart' | 'dtend'> {
    dtstart: number | null;
    dtend: number | null;
}

interface CalendarEventsFile {
    schemaVersion: number;
    updatedAt: number;
    calendarId: string;
    events: PersistedEvent[];
}

let basePath: string | null = null;
let writeLock: Promise<void> = Promise.resolve();

function enqueueWrite<T>(operation: () => Promise<T>): Promise<T> {
    const next = writeLock.then(operation, operation);
    writeLock = next.then(() => undefined, () => undefined);
    return next;
}

async function waitForPendingWrites(): Promise<void> {
    await writeLock;
}

function defaultCalendars(): NekoCalendar[] {
    return [{ id: 'main', name: 'Main', color: 'blue', visible: true }];
}

function sanitizeCalendars(input: NekoCalendar[]): NekoCalendar[] {
    const seen = new Set<string>();
    const sanitized: NekoCalendar[] = [];
    for (const calendar of input) {
        if (!calendar?.id || seen.has(calendar.id)) {
            continue;
        }
        seen.add(calendar.id);
        sanitized.push({
            id: calendar.id,
            name: calendar.name || 'Untitled',
            color: calendar.color,
            visible: calendar.visible !== false,
        });
    }
    return sanitized.length > 0 ? sanitized : defaultCalendars();
}

function toPersistedEvent(event: NekoEvent): PersistedEvent {
    return {
        ...event,
        dtstart: event.dtstart instanceof Date ? event.dtstart.getTime() : null,
        dtend: event.dtend instanceof Date ? event.dtend.getTime() : null,
    };
}

function toRuntimeEvent(event: PersistedEvent, fallbackCalendarId: string): NekoEvent {
    const now = Date.now();
    const startMs = typeof event.dtstart === 'number' && Number.isFinite(event.dtstart)
        ? event.dtstart
        : now;
    const rawEndMs = typeof event.dtend === 'number' && Number.isFinite(event.dtend)
        ? event.dtend
        : startMs + DEFAULT_EVENT_DURATION_MS;
    const endMs = rawEndMs >= startMs ? rawEndMs : startMs + DEFAULT_EVENT_DURATION_MS;

    return {
        ...event,
        calendarId: event.calendarId || fallbackCalendarId,
        dtstart: new Date(startMs),
        dtend: new Date(endMs),
    };
}

function arePersistedEventsEqual(a: PersistedEvent[], b: PersistedEvent[]): boolean {
    if (a.length !== b.length) {
        return false;
    }
    for (let i = 0; i < a.length; i += 1) {
        if (JSON.stringify(a[i]) !== JSON.stringify(b[i])) {
            return false;
        }
    }
    return true;
}

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

async function getCalendarRootPath(): Promise<string> {
    const base = await getBasePath();
    return joinPath(base, '.nekotick', CALENDAR_ROOT_DIR);
}

async function getCalendarMetaPath(): Promise<string> {
    const root = await getCalendarRootPath();
    return joinPath(root, CALENDAR_META_FILE);
}

async function getCalendarEventsDir(): Promise<string> {
    const root = await getCalendarRootPath();
    return joinPath(root, CALENDAR_EVENTS_DIR);
}

async function getCalendarEventsPath(calendarId: string): Promise<string> {
    const eventsDir = await getCalendarEventsDir();
    return joinPath(eventsDir, `${calendarId}.json`);
}

async function ensureCalendarDirs(): Promise<void> {
    const storage = getStorageAdapter();
    const root = await getCalendarRootPath();
    const eventsDir = await getCalendarEventsDir();
    if (!(await storage.exists(root))) {
        await storage.mkdir(root, true);
    }
    if (!(await storage.exists(eventsDir))) {
        await storage.mkdir(eventsDir, true);
    }
}

async function writeJson(path: string, data: unknown): Promise<void> {
    const storage = getStorageAdapter();
    await storage.writeFile(path, JSON.stringify(data, null, 2));
}

async function readJson<T>(path: string): Promise<T | null> {
    const storage = getStorageAdapter();
    if (!(await storage.exists(path))) {
        return null;
    }
    const content = await storage.readFile(path);
    return JSON.parse(content) as T;
}

async function loadOrCreateMetaFile(): Promise<CalendarMetaFile> {
    await ensureCalendarDirs();
    const metaPath = await getCalendarMetaPath();
    const existing = await readJson<CalendarMetaFile>(metaPath);

    if (existing && Array.isArray(existing.calendars)) {
        const normalized: CalendarMetaFile = {
            schemaVersion: STORAGE_SCHEMA_VERSION,
            updatedAt: Date.now(),
            calendars: sanitizeCalendars(existing.calendars),
        };
        if (normalized.calendars.length !== existing.calendars.length || existing.schemaVersion !== STORAGE_SCHEMA_VERSION) {
            await writeJson(metaPath, normalized);
        }
        return normalized;
    }

    const initial: CalendarMetaFile = {
        schemaVersion: STORAGE_SCHEMA_VERSION,
        updatedAt: Date.now(),
        calendars: defaultCalendars(),
    };
    await writeJson(metaPath, initial);
    return initial;
}

async function writeMetaFile(calendars: NekoCalendar[]): Promise<void> {
    await ensureCalendarDirs();
    const metaPath = await getCalendarMetaPath();
    const payload: CalendarMetaFile = {
        schemaVersion: STORAGE_SCHEMA_VERSION,
        updatedAt: Date.now(),
        calendars: sanitizeCalendars(calendars),
    };
    await writeJson(metaPath, payload);
}

async function readCalendarEvents(calendarId: string): Promise<NekoEvent[]> {
    const eventsPath = await getCalendarEventsPath(calendarId);
    const existing = await readJson<CalendarEventsFile>(eventsPath);
    if (!existing || !Array.isArray(existing.events)) {
        return [];
    }
    return existing.events.map(event => toRuntimeEvent(event, calendarId));
}

async function writeCalendarEvents(
    calendarId: string,
    events: NekoEvent[],
    options?: { skipIfUnchanged?: boolean }
): Promise<boolean> {
    await ensureCalendarDirs();
    const eventsPath = await getCalendarEventsPath(calendarId);
    const persistedEvents = events.map(toPersistedEvent);

    if (options?.skipIfUnchanged) {
        const existing = await readJson<CalendarEventsFile>(eventsPath);
        if (
            existing
            && existing.schemaVersion === STORAGE_SCHEMA_VERSION
            && existing.calendarId === calendarId
            && Array.isArray(existing.events)
            && arePersistedEventsEqual(existing.events, persistedEvents)
        ) {
            return false;
        }
    }

    const payload: CalendarEventsFile = {
        schemaVersion: STORAGE_SCHEMA_VERSION,
        updatedAt: Date.now(),
        calendarId,
        events: persistedEvents,
    };
    await writeJson(eventsPath, payload);
    return true;
}

export async function loadCalendarsMeta(): Promise<NekoCalendar[]> {
    await waitForPendingWrites();
    const meta = await loadOrCreateMetaFile();
    return meta.calendars;
}

export async function saveCalendarsMeta(calendars: NekoCalendar[]): Promise<void> {
    await enqueueWrite(async () => {
        await writeMetaFile(calendars);
    });
}

export async function loadAllEvents(): Promise<NekoEvent[]> {
    await waitForPendingWrites();
    const calendars = await loadCalendarsMeta();
    const all: NekoEvent[] = [];

    for (const calendar of calendars) {
        const events = await readCalendarEvents(calendar.id);
        for (const event of events) {
            all.push(event.color ? event : { ...event, color: calendar.color });
        }
    }

    return all;
}

export async function saveAllEvents(events: NekoEvent[], calendars: NekoCalendar[]): Promise<void> {
    await enqueueWrite(async () => {
        await ensureCalendarDirs();
        const effectiveCalendars = calendars.length > 0 ? calendars : defaultCalendars();
        if (calendars.length === 0) {
            await writeMetaFile(effectiveCalendars);
        }

        const eventsByCalendar = new Map<string, NekoEvent[]>();
        for (const calendar of effectiveCalendars) {
            eventsByCalendar.set(calendar.id, []);
        }

        for (const event of events) {
            const targetCalendarId = eventsByCalendar.has(event.calendarId)
                ? event.calendarId
                : effectiveCalendars[0]?.id;
            if (!targetCalendarId) {
                continue;
            }
            const bucket = eventsByCalendar.get(targetCalendarId);
            if (!bucket) {
                continue;
            }
            bucket.push({
                ...event,
                calendarId: targetCalendarId,
            });
        }

        for (const calendar of effectiveCalendars) {
            const bucket = eventsByCalendar.get(calendar.id) || [];
            await writeCalendarEvents(calendar.id, bucket, { skipIfUnchanged: true });
        }
    });
}

export async function addCalendar(name: string, color: ItemColor): Promise<NekoCalendar> {
    return enqueueWrite(async () => {
        const meta = await loadOrCreateMetaFile();
        const newCalendar: NekoCalendar = {
            id: `cal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            name,
            color,
            visible: true,
        };
        const nextCalendars = [...meta.calendars, newCalendar];
        await writeCalendarEvents(newCalendar.id, []);
        await writeMetaFile(nextCalendars);
        return newCalendar;
    });
}

export async function deleteCalendar(calendarId: string): Promise<void> {
    await enqueueWrite(async () => {
        const storage = getStorageAdapter();
        const meta = await loadOrCreateMetaFile();
        const nextCalendars = meta.calendars.filter(c => c.id !== calendarId);
        if (nextCalendars.length === 0) {
            throw new Error('Cannot delete the last calendar');
        }
        await writeMetaFile(nextCalendars);

        const eventsPath = await getCalendarEventsPath(calendarId);
        if (await storage.exists(eventsPath)) {
            await storage.deleteFile(eventsPath);
        }
    });
}

export async function updateCalendar(
    calendarId: string,
    updates: Partial<Pick<NekoCalendar, 'name' | 'color' | 'visible'>>
): Promise<void> {
    await enqueueWrite(async () => {
        const meta = await loadOrCreateMetaFile();
        const index = meta.calendars.findIndex(c => c.id === calendarId);
        if (index === -1) {
            throw new Error(`Calendar not found: ${calendarId}`);
        }
        const nextCalendars = [...meta.calendars];
        nextCalendars[index] = { ...nextCalendars[index], ...updates };
        await writeMetaFile(nextCalendars);
    });
}
