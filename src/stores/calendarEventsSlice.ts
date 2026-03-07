import { create } from 'zustand';
import type { NekoEvent, NekoCalendar } from '@/lib/ics/types';
import type { ItemColor } from '@/lib/colors';
import { DEFAULT_COLOR } from '@/lib/colors';
import { normalizeTags } from '@/lib/tags/tagUtils';
import { getDescendantIds, getChildren, reorderSiblings } from './taskTreeUtils';
import {
    loadCalendarsMeta,
    saveCalendarsMeta,
    loadAllEvents,
    saveAllEvents,
    addCalendar as addCalendarToStorage,
    deleteCalendar as deleteCalendarFromStorage,
    updateCalendar as updateCalendarInStorage,
} from '@/lib/storage/calendarStorage';
import { createPersistenceQueue } from '@/lib/storage/persistenceEngine';

type CalendarPersistPayload = {
    calendars: NekoCalendar[];
    events: NekoEvent[];
};

function cloneCalendarPayload(calendars: NekoCalendar[], events: NekoEvent[]): CalendarPersistPayload {
    return {
        calendars: calendars.map((calendar) => ({ ...calendar })),
        events: events.map((event) => ({ ...event })),
    };
}

function formatStorageError(error: unknown): string {
    if (error instanceof Error) return error.message;
    return String(error);
}

interface CalendarEventsState {
    calendars: NekoCalendar[];
    events: NekoEvent[];
    loaded: boolean;
    storageStatus: 'healthy' | 'degraded';
    lastStorageError: string | null;
    lastStorageErrorAt: number | null;

    load: () => Promise<void>;
    save: () => Promise<void>;
    flushPersistence: () => Promise<void>;
    runStorageHealthCheck: () => Promise<boolean>;

    addEvent: (event: Omit<NekoEvent, 'uid'> & { uid?: string }) => Promise<void>;
    updateEvent: (
        uid: string,
        updates: Partial<NekoEvent>,
        options?: { persist?: boolean }
    ) => Promise<void>;
    deleteEvent: (uid: string) => Promise<void>;

    addTask: (content: string, groupId: string, calendarId?: string, color?: ItemColor, tags?: string[]) => Promise<void>;
    addSubTask: (parentId: string, content: string) => Promise<void>;
    updateTaskOrder: (activeId: string, overId: string) => Promise<void>;
    moveTaskToGroup: (taskId: string, targetGroupId: string, overTaskId?: string | null) => Promise<void>;
    toggleTaskCollapse: (uid: string) => Promise<void>;

    addCalendar: (name: string, color: ItemColor) => Promise<void>;
    updateCalendar: (id: string, updates: Partial<Pick<NekoCalendar, 'name' | 'color' | 'visible'>>) => Promise<void>;
    deleteCalendar: (id: string) => Promise<void>;
    toggleCalendarVisibility: (id: string) => void;

    startTimer: (uid: string) => void;
    pauseTimer: (uid: string) => void;
    resumeTimer: (uid: string) => void;
    stopTimer: (uid: string) => void;

    toggleComplete: (uid: string) => void;
}

export const useCalendarEventsStore = create<CalendarEventsState>()((set, get) => {
    let calendarPersistQueue: ReturnType<typeof createPersistenceQueue<CalendarPersistPayload>>;

    const setStorageHealthy = (): void => {
        if (calendarPersistQueue.hasPending()) return;
        set((state) => {
            if (
                state.storageStatus === 'healthy'
                && state.lastStorageError === null
                && state.lastStorageErrorAt === null
            ) {
                return state;
            }
            return {
                storageStatus: 'healthy' as const,
                lastStorageError: null,
                lastStorageErrorAt: null,
            };
        });
    };

    const setStorageDegraded = (source: string, error: unknown): void => {
        const message = `${source}: ${formatStorageError(error)}`;
        console.error(`[CalendarEventsStore] ${message}`, error);
        set({
            storageStatus: 'degraded',
            lastStorageError: message,
            lastStorageErrorAt: Date.now(),
        });
    };

    calendarPersistQueue = createPersistenceQueue<CalendarPersistPayload>({
        debounceMs: 120,
        maxWaitMs: 1800,
        write: async ({ calendars, events }) => {
            await saveCalendarsMeta(calendars);
            await saveAllEvents(events, calendars);
        },
        onError: (error) => setStorageDegraded('persist', error),
        onIdle: () => setStorageHealthy(),
    });

    return {
        calendars: [],
        events: [],
        loaded: false,
        storageStatus: 'healthy',
        lastStorageError: null,
        lastStorageErrorAt: null,

        load: async () => {
            try {
                const calendars = await loadCalendarsMeta();
                const events = await loadAllEvents();

                set({
                    calendars,
                    events,
                    loaded: true,
                    storageStatus: 'healthy',
                    lastStorageError: null,
                    lastStorageErrorAt: null,
                });
            } catch (error) {
                setStorageDegraded('load', error);
                set({ loaded: true });
            }
        },

        save: async () => {
            const { calendars, events } = get();
            calendarPersistQueue.schedule(cloneCalendarPayload(calendars, events));
        },

        flushPersistence: async () => {
            const { calendars, events } = get();
            calendarPersistQueue.schedule(cloneCalendarPayload(calendars, events), { debounceMs: 0, maxWaitMs: 0 });
            await calendarPersistQueue.flush();
            setStorageHealthy();
        },

        runStorageHealthCheck: async () => {
            try {
                await loadCalendarsMeta();
                await loadAllEvents();
                const { storageStatus } = get();
                if (calendarPersistQueue.hasPending() && storageStatus === 'degraded') {
                    return true;
                }
                setStorageHealthy();
                return true;
            } catch (error) {
                setStorageDegraded('health-check', error);
                return false;
            }
        },

        addEvent: async (eventData) => {
            const newEvent: NekoEvent = {
                ...eventData,
                uid: eventData.uid || crypto.randomUUID(),
                color: eventData.color || DEFAULT_COLOR,
                createdAt: eventData.createdAt ?? Date.now(),
            };

            set((state) => ({
                events: [...state.events, newEvent],
            }));

            await get().flushPersistence();
        },

        updateEvent: async (uid, updates, options) => {
            set((state) => ({
                events: state.events.map((e) =>
                    e.uid === uid ? { ...e, ...updates } : e
                ),
            }));
            if (options?.persist ?? true) {
                await get().flushPersistence();
            }
        },

        deleteEvent: async (uid) => {
            set((state) => ({
                events: state.events.filter((e) => e.uid !== uid),
            }));

            await get().flushPersistence();
        },

        addTask: async (content, groupId, calendarId, color, tags) => {
            const state = get();
            const targetCalendarId = calendarId || state.calendars[0]?.id || 'main';
            const normalizedTags = normalizeTags(tags);
            const createdAt = Date.now();

            const groupTasks = getChildren(state.events, null, groupId);

            const newEvent: NekoEvent = {
                uid: crypto.randomUUID(),
                summary: content,
                dtstart: new Date(createdAt),
                dtend: new Date(createdAt),
                allDay: false,
                createdAt,
                scheduled: false,
                calendarId: targetCalendarId,
                groupId: groupId,
                order: groupTasks.length,
                color: color || DEFAULT_COLOR,
                tags: normalizedTags.length > 0 ? normalizedTags : undefined,
                completed: false,
            };

            await get().addEvent(newEvent);
        },

        addSubTask: async (parentId, content) => {
            const state = get();
            const parent = state.events.find((e) => e.uid === parentId);
            if (!parent) return;
            const createdAt = Date.now();

            const siblings = getChildren(state.events, parentId);

            const newEvent: NekoEvent = {
                uid: crypto.randomUUID(),
                summary: content,
                dtstart: new Date(createdAt),
                dtend: new Date(createdAt),
                allDay: false,
                createdAt,
                scheduled: false,
                calendarId: parent.calendarId,
                groupId: parent.groupId,
                parentId: parentId,
                order: siblings.length,
                color: parent.color,
                completed: false,
            };

            await get().addEvent(newEvent);
        },

        updateTaskOrder: async (activeId, overId) => {
            const state = get();
            const activeEvent = state.events.find((e) => e.uid === activeId);
            const overEvent = state.events.find((e) => e.uid === overId);

            if (!activeEvent || !overEvent) return;

            if (activeEvent.groupId !== overEvent.groupId) return;
            const activeParent = activeEvent.parentId || null;
            const overParent = overEvent.parentId || null;
            if (activeParent !== overParent) return;

            const siblings = getChildren(state.events, activeParent, activeEvent.groupId);
            const oldIndex = siblings.findIndex((e) => e.uid === activeId);
            const newIndex = siblings.findIndex((e) => e.uid === overId);

            if (oldIndex === -1 || newIndex === -1) return;

            const reorderedSiblings = reorderSiblings(siblings, oldIndex, newIndex);
            const orderMap = new Map(reorderedSiblings.map((e) => [e.uid, e.order]));

            set((state) => ({
                events: state.events.map((e) => {
                    if (orderMap.has(e.uid)) {
                        return { ...e, order: orderMap.get(e.uid) };
                    }
                    return e;
                }),
            }));

            await get().flushPersistence();
        },

        moveTaskToGroup: async (taskId, targetGroupId, overTaskId) => {
            const state = get();
            const task = state.events.find((e) => e.uid === taskId);
            if (!task) return;

            const idsToMove = new Set(getDescendantIds(state.events, taskId));

            const targetTasks = getChildren(state.events, null, targetGroupId);
            let newOrder = targetTasks.length;

            if (overTaskId) {
                const overTask = state.events.find((e) => e.uid === overTaskId);
                if (overTask && overTask.groupId === targetGroupId) {
                    newOrder = overTask.order || 0;
                }
            }

            set((state) => ({
                events: state.events.map((e) => {
                    if (e.uid === taskId) {
                        return { ...e, groupId: targetGroupId, order: newOrder, parentId: undefined };
                    }
                    if (idsToMove.has(e.uid)) {
                        return { ...e, groupId: targetGroupId };
                    }
                    return e;
                }),
            }));

            await get().flushPersistence();
        },

        toggleTaskCollapse: async (uid) => {
            const event = get().events.find((e) => e.uid === uid);
            if (!event) return;

            await get().updateEvent(uid, { collapsed: !event.collapsed });
        },

        addCalendar: async (name, color) => {
            try {
                const newCalendar = await addCalendarToStorage(name, color);
                set((state) => ({
                    calendars: [...state.calendars, newCalendar],
                }));
                setStorageHealthy();
            } catch (error) {
                setStorageDegraded('addCalendar', error);
                throw error;
            }
        },

        updateCalendar: async (id, updates) => {
            try {
                await updateCalendarInStorage(id, updates);
                set((state) => ({
                    calendars: state.calendars.map((c) =>
                        c.id === id ? { ...c, ...updates } : c
                    ),
                }));
                setStorageHealthy();
            } catch (error) {
                setStorageDegraded('updateCalendar', error);
                throw error;
            }
        },

        deleteCalendar: async (id) => {
            try {
                await deleteCalendarFromStorage(id);
                set((state) => ({
                    calendars: state.calendars.filter((c) => c.id !== id),
                    events: state.events.filter((e) => e.calendarId !== id),
                }));
                setStorageHealthy();
            } catch (error) {
                setStorageDegraded('deleteCalendar', error);
                throw error;
            }
        },

        toggleCalendarVisibility: (id) => {
            set((state) => ({
                calendars: state.calendars.map((c) =>
                    c.id === id ? { ...c, visible: !c.visible } : c
                ),
            }));
            void get().save();
        },

        startTimer: (uid) => {
            set((state) => ({
                events: state.events.map((e) =>
                    e.uid === uid
                        ? { ...e, timerState: 'running' as const, timerStartedAt: Date.now() }
                        : e
                ),
            }));
            void get().save();
        },

        pauseTimer: (uid) => {
            const event = get().events.find((e) => e.uid === uid);
            if (!event || event.timerState !== 'running') return;

            const elapsed = event.timerStartedAt ? Date.now() - event.timerStartedAt : 0;
            const accumulated = (event.timerAccumulated || 0) + elapsed;

            set((state) => ({
                events: state.events.map((e) =>
                    e.uid === uid
                        ? { ...e, timerState: 'paused' as const, timerAccumulated: accumulated, timerStartedAt: undefined }
                        : e
                ),
            }));
            void get().save();
        },

        resumeTimer: (uid) => {
            set((state) => ({
                events: state.events.map((e) =>
                    e.uid === uid
                        ? { ...e, timerState: 'running' as const, timerStartedAt: Date.now() }
                        : e
                ),
            }));
            void get().save();
        },

        stopTimer: (uid) => {
            const event = get().events.find((e) => e.uid === uid);
            if (!event) return;

            let finalAccumulated = event.timerAccumulated || 0;
            if (event.timerState === 'running' && event.timerStartedAt) {
                finalAccumulated += Date.now() - event.timerStartedAt;
            }

            set((state) => ({
                events: state.events.map((e) =>
                    e.uid === uid
                        ? { ...e, timerState: 'idle' as const, timerAccumulated: finalAccumulated, timerStartedAt: undefined }
                        : e
                ),
            }));
            void get().save();
        },

        toggleComplete: (uid) => {
            set((state) => ({
                events: state.events.map((e) =>
                    e.uid === uid ? { ...e, completed: !e.completed } : e
                ),
            }));
            void get().save();
        },
    };
});
