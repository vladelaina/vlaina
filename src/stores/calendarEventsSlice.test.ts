import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { NekoCalendar, NekoEvent } from '@/lib/ics/types';

const storageMocks = vi.hoisted(() => ({
  loadCalendarsMeta: vi.fn(),
  saveCalendarsMeta: vi.fn(),
  loadAllEvents: vi.fn(),
  saveAllEvents: vi.fn(),
  addCalendar: vi.fn(),
  deleteCalendar: vi.fn(),
  updateCalendar: vi.fn(),
}));

const addToastMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/storage/calendarStorage', () => ({
  loadCalendarsMeta: storageMocks.loadCalendarsMeta,
  saveCalendarsMeta: storageMocks.saveCalendarsMeta,
  loadAllEvents: storageMocks.loadAllEvents,
  saveAllEvents: storageMocks.saveAllEvents,
  addCalendar: storageMocks.addCalendar,
  deleteCalendar: storageMocks.deleteCalendar,
  updateCalendar: storageMocks.updateCalendar,
}));

vi.mock('./useToastStore', () => ({
  useToastStore: {
    getState: () => ({
      addToast: addToastMock,
    }),
  },
}));

const MAIN_CALENDAR: NekoCalendar = {
  id: 'main',
  name: 'Main',
  color: 'blue',
  visible: true,
};

function makeEvent(uid = 'event-1'): NekoEvent {
  return {
    uid,
    summary: 'Test Event',
    dtstart: new Date('2026-03-05T09:00:00.000Z'),
    dtend: new Date('2026-03-05T09:30:00.000Z'),
    allDay: false,
    calendarId: 'main',
    completed: false,
    color: 'blue',
    scheduled: true,
  };
}

describe('calendarEventsSlice retry behavior', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    addToastMock.mockReset();
    storageMocks.loadCalendarsMeta.mockReset().mockResolvedValue([MAIN_CALENDAR]);
    storageMocks.saveCalendarsMeta.mockReset().mockResolvedValue(undefined);
    storageMocks.loadAllEvents.mockReset().mockResolvedValue([]);
    storageMocks.saveAllEvents.mockReset().mockResolvedValue(undefined);
    storageMocks.addCalendar.mockReset().mockResolvedValue({ ...MAIN_CALENDAR, id: 'cal_new' });
    storageMocks.deleteCalendar.mockReset().mockResolvedValue(undefined);
    storageMocks.updateCalendar.mockReset().mockResolvedValue(undefined);
  });

  afterEach(async () => {
    await vi.runOnlyPendingTimersAsync();
    vi.useRealTimers();
  });

  it('keeps pending event retry when health-check succeeds', async () => {
    let saveCalls = 0;
    storageMocks.saveAllEvents.mockImplementation(async () => {
      saveCalls += 1;
      if (saveCalls === 1) {
        throw new Error('disk unavailable');
      }
    });

    const { useCalendarEventsStore } = await import('./calendarEventsSlice');
    await useCalendarEventsStore.getState().load();
    useCalendarEventsStore.setState({ events: [makeEvent()] });

    await useCalendarEventsStore.getState().save();
    expect(useCalendarEventsStore.getState().storageStatus).toBe('degraded');
    expect(saveCalls).toBe(1);

    const healthOk = await useCalendarEventsStore.getState().runStorageHealthCheck();
    expect(healthOk).toBe(true);
    expect(useCalendarEventsStore.getState().storageStatus).toBe('degraded');
    expect(saveCalls).toBe(1);

    await vi.advanceTimersByTimeAsync(1200);
    expect(saveCalls).toBe(2);
    expect(useCalendarEventsStore.getState().storageStatus).toBe('healthy');
  });

  it('does not let meta success clear pending event retry', async () => {
    let saveCalls = 0;
    storageMocks.saveAllEvents.mockImplementation(async () => {
      saveCalls += 1;
      if (saveCalls === 1) {
        throw new Error('event write failed');
      }
    });

    const { useCalendarEventsStore } = await import('./calendarEventsSlice');
    await useCalendarEventsStore.getState().load();
    useCalendarEventsStore.setState({ events: [makeEvent()] });

    await useCalendarEventsStore.getState().save();
    expect(useCalendarEventsStore.getState().storageStatus).toBe('degraded');
    expect(saveCalls).toBe(1);

    useCalendarEventsStore.getState().toggleCalendarVisibility('main');
    await vi.runAllTicks();
    expect(storageMocks.saveCalendarsMeta).toHaveBeenCalledTimes(1);
    expect(useCalendarEventsStore.getState().storageStatus).toBe('degraded');

    await vi.advanceTimersByTimeAsync(1200);
    expect(saveCalls).toBe(2);
    expect(useCalendarEventsStore.getState().storageStatus).toBe('healthy');
  });

  it('rethrows calendar CRUD storage errors', async () => {
    storageMocks.addCalendar.mockRejectedValueOnce(new Error('add fail'));
    storageMocks.updateCalendar.mockRejectedValueOnce(new Error('update fail'));
    storageMocks.deleteCalendar.mockRejectedValueOnce(new Error('delete fail'));

    const { useCalendarEventsStore } = await import('./calendarEventsSlice');
    await useCalendarEventsStore.getState().load();

    await expect(useCalendarEventsStore.getState().addCalendar('Work', 'green')).rejects.toThrow('add fail');
    await expect(useCalendarEventsStore.getState().updateCalendar('main', { name: 'Main 2' })).rejects.toThrow('update fail');
    await expect(useCalendarEventsStore.getState().deleteCalendar('main')).rejects.toThrow('delete fail');
  });
});
