import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NekoCalendar, NekoEvent } from '@/lib/ics/types';

const mockedStorage = vi.hoisted(() => {
  type DelayMatcher = ((path: string, content: string) => number) | null;
  type FailMatcher = ((path: string, content: string) => string | null) | null;

  const files = new Map<string, string>();
  const dirs = new Set<string>();
  const writes: string[] = [];
  let delayMatcher: DelayMatcher = null;
  let failMatcher: FailMatcher = null;

  const normalize = (path: string): string =>
    path.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '') || '/';

  const addDirRecursive = (path: string): void => {
    const normalized = normalize(path);
    const parts = normalized.split('/').filter(Boolean);
    let current = '';
    dirs.add('/');
    for (const part of parts) {
      current += `/${part}`;
      dirs.add(current);
    }
  };

  const joinPath = (...segments: string[]): string => {
    const filtered = segments.filter(Boolean);
    if (filtered.length === 0) return '/';
    return normalize(filtered.join('/'));
  };

  const adapter = {
    platform: 'web' as const,
    async readFile(path: string): Promise<string> {
      const normalized = normalize(path);
      const value = files.get(normalized);
      if (value === undefined) {
        throw new Error(`File not found: ${normalized}`);
      }
      return value;
    },
    async readBinaryFile(): Promise<Uint8Array> {
      return new Uint8Array();
    },
    async writeFile(path: string, content: string): Promise<void> {
      const normalized = normalize(path);
      const failureMessage = failMatcher?.(normalized, content);
      if (failureMessage) {
        throw new Error(failureMessage);
      }
      const delay = delayMatcher?.(normalized, content) ?? 0;
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
      addDirRecursive(normalized.split('/').slice(0, -1).join('/') || '/');
      files.set(normalized, content);
      writes.push(normalized);
    },
    async writeBinaryFile(): Promise<void> {},
    async deleteFile(path: string): Promise<void> {
      files.delete(normalize(path));
    },
    async deleteDir(): Promise<void> {},
    async exists(path: string): Promise<boolean> {
      const normalized = normalize(path);
      return files.has(normalized) || dirs.has(normalized);
    },
    async mkdir(path: string): Promise<void> {
      addDirRecursive(path);
    },
    async listDir(): Promise<never[]> {
      return [];
    },
    async rename(oldPath: string, newPath: string): Promise<void> {
      const oldNormalized = normalize(oldPath);
      const newNormalized = normalize(newPath);
      const content = files.get(oldNormalized);
      if (content === undefined) return;
      files.set(newNormalized, content);
      files.delete(oldNormalized);
    },
    async copyFile(src: string, dest: string): Promise<void> {
      const source = files.get(normalize(src));
      if (source === undefined) return;
      files.set(normalize(dest), source);
    },
    async stat() {
      return null;
    },
    async getBasePath(): Promise<string> {
      return '/app';
    },
  };

  return {
    adapter,
    joinPath,
    reset() {
      files.clear();
      dirs.clear();
      writes.length = 0;
      delayMatcher = null;
      failMatcher = null;
    },
    clearWrites() {
      writes.length = 0;
    },
    setDelayMatcher(matcher: DelayMatcher) {
      delayMatcher = matcher;
    },
    setFailMatcher(matcher: FailMatcher) {
      failMatcher = matcher;
    },
    getWrites() {
      return [...writes];
    },
    readFile(path: string) {
      return files.get(normalize(path)) ?? null;
    },
  };
});

vi.mock('@/lib/storage/adapter', () => ({
  getStorageAdapter: () => mockedStorage.adapter,
  joinPath: async (...segments: string[]) => mockedStorage.joinPath(...segments),
}));

import {
  addCalendar,
  loadCalendarsMeta,
  loadAllEvents,
  saveAllEvents,
  saveCalendarsMeta,
} from './calendarStorage';

function makeEvent(params: {
  uid: string;
  calendarId: string;
  summary: string;
  scheduled?: boolean;
  createdAt?: number;
}): NekoEvent {
  return {
    uid: params.uid,
    summary: params.summary,
    dtstart: new Date('2026-03-04T09:00:00.000Z'),
    dtend: new Date('2026-03-04T09:30:00.000Z'),
    allDay: false,
    scheduled: params.scheduled ?? true,
    createdAt: params.createdAt,
    calendarId: params.calendarId,
    completed: false,
    color: 'blue',
  };
}

describe('calendarStorage', () => {
  beforeEach(() => {
    mockedStorage.reset();
  });

  it('only writes changed calendar event files on subsequent saves', async () => {
    const calendars: NekoCalendar[] = [
      { id: 'main', name: 'Main', color: 'blue', visible: true },
      { id: 'work', name: 'Work', color: 'green', visible: true },
    ];

    await saveCalendarsMeta(calendars);
    await saveAllEvents(
      [
        makeEvent({ uid: 'e-main', calendarId: 'main', summary: 'Main Event' }),
        makeEvent({ uid: 'e-work', calendarId: 'work', summary: 'Work Event' }),
      ],
      calendars
    );

    mockedStorage.clearWrites();
    await saveAllEvents(
      [
        makeEvent({ uid: 'e-main', calendarId: 'main', summary: 'Main Event Updated' }),
        makeEvent({ uid: 'e-work', calendarId: 'work', summary: 'Work Event' }),
      ],
      calendars
    );

    const writes = mockedStorage
      .getWrites()
      .filter((path) => path.endsWith('/calendars/main.ics') || path.endsWith('/calendars/work.ics'));

    expect(writes).toEqual(['/app/.nekotick/calendars/main.ics']);
  });

  it('serializes concurrent saves so last write wins deterministically', async () => {
    const calendars: NekoCalendar[] = [
      { id: 'main', name: 'Main', color: 'blue', visible: true },
    ];
    await saveCalendarsMeta(calendars);

    mockedStorage.setDelayMatcher((_path, content) => (content.includes('"summary": "A"') ? 40 : 0));

    const saveA = saveAllEvents([makeEvent({ uid: 'e-1', calendarId: 'main', summary: 'A' })], calendars);
    const saveB = saveAllEvents([makeEvent({ uid: 'e-1', calendarId: 'main', summary: 'B' })], calendars);
    await Promise.all([saveA, saveB]);

    const loaded = await loadAllEvents();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.summary).toBe('B');
  });

  it('persists and restores unscheduled tasks', async () => {
    const calendars: NekoCalendar[] = [
      { id: 'main', name: 'Main', color: 'blue', visible: true },
    ];
    await saveCalendarsMeta(calendars);

    await saveAllEvents(
      [makeEvent({
        uid: 'todo-1',
        calendarId: 'main',
        summary: 'Todo',
        scheduled: false,
        createdAt: 1710000000000,
      })],
      calendars
    );

    const loaded = await loadAllEvents();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.scheduled).toBe(false);
    expect(loaded[0]?.createdAt).toBe(1710000000000);
    expect(loaded[0]?.dtstart).toBeInstanceOf(Date);
    expect(loaded[0]?.dtend).toBeInstanceOf(Date);
  });

  it('creates default calendar metadata when saving with empty calendar list', async () => {
    await saveAllEvents([makeEvent({ uid: 'e-1', calendarId: 'unknown', summary: 'Event' })], []);

    const calendars = await loadCalendarsMeta();
    expect(calendars).toHaveLength(1);
    expect(calendars[0]?.id).toBe('main');
    const mainCalendarIcs = mockedStorage.readFile('/app/.nekotick/calendars/main.ics');
    expect(mainCalendarIcs).toContain('BEGIN:VEVENT');
  });

  it('does not write calendar metadata when new calendar event file creation fails', async () => {
    const calendars: NekoCalendar[] = [
      { id: 'main', name: 'Main', color: 'blue', visible: true },
    ];
    await saveCalendarsMeta(calendars);

    mockedStorage.setFailMatcher((path) => {
      if (path.includes('/calendars/cal_')) {
        return 'simulated write failure';
      }
      return null;
    });

    await expect(addCalendar('Work', 'green')).rejects.toThrow('simulated write failure');

    const storedCalendars = await loadCalendarsMeta();
    expect(storedCalendars).toEqual(calendars);
  });
});
