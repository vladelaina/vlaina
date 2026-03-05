import { create } from 'zustand';
import type { NekoEvent, NekoCalendar } from '@/lib/ics/types';
import type { ItemColor } from '@/lib/colors';
import { DEFAULT_COLOR } from '@/lib/colors';
import { normalizeTags } from '@/lib/tags/tagUtils';
import { useToastStore } from './useToastStore';
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

const DEFAULT_MAIN_CALENDAR: NekoCalendar = {
    id: 'main',
    name: 'Main',
    color: 'blue',
    visible: true,
};
const MAX_RETRY_ATTEMPTS = 5;
const RETRY_BASE_DELAY_MS = 1200;
const STORAGE_TOAST_COOLDOWN_MS = 15000;

type RetryChannel = 'events' | 'meta';
interface RetryState {
    timer: ReturnType<typeof setTimeout> | null;
    attempts: number;
    task: (() => Promise<void>) | null;
}
interface MarkHealthyOptions {
    preservePendingRetry?: boolean;
}

const retryStates: Record<RetryChannel, RetryState> = {
    events: { timer: null, attempts: 0, task: null },
    meta: { timer: null, attempts: 0, task: null },
};
const channelErrors: Record<RetryChannel, string | null> = {
    events: null,
    meta: null,
};
let lastStorageToastAt = 0;

function formatStorageError(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}

function getRetryDelay(attempt: number): number {
    const factor = Math.min(attempt, 4);
    return RETRY_BASE_DELAY_MS * (2 ** factor);
}

function showStorageToast(message: string, type: 'error' | 'warning' | 'success', force = false): void {
    const now = Date.now();
    if (!force && now - lastStorageToastAt < STORAGE_TOAST_COOLDOWN_MS) {
        return;
    }
    lastStorageToastAt = now;
    useToastStore.getState().addToast(message, type, 4500);
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
    runStorageHealthCheck: () => Promise<boolean>;

    addEvent: (event: Omit<NekoEvent, 'uid'> & { uid?: string }) => Promise<void>;
    updateEvent: (
        uid: string,
        updates: Partial<NekoEvent>,
        options?: { persist?: boolean }
    ) => Promise<void>;
    deleteEvent: (uid: string) => Promise<void>;
    deleteCompletedEventsInCalendar: (calendarId: string) => Promise<void>;

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
    const getFirstChannelError = (): string | null => {
        if (channelErrors.events) return channelErrors.events;
        if (channelErrors.meta) return channelErrors.meta;
        return null;
    };

    const clearRetryState = (channel: RetryChannel) => {
        const slot = retryStates[channel];
        slot.attempts = 0;
        slot.task = null;
        if (slot.timer) {
            clearTimeout(slot.timer);
            slot.timer = null;
        }
    };

    const hasPendingRetry = (channel: RetryChannel | 'all'): boolean => {
        if (channel === 'all') {
            return (retryStates.events.timer !== null || retryStates.events.task !== null)
                || (retryStates.meta.timer !== null || retryStates.meta.task !== null);
        }
        const slot = retryStates[channel];
        return slot.timer !== null || slot.task !== null;
    };

    const markStorageHealthy = (
        source: string,
        channel: RetryChannel | 'all' = 'all',
        options?: MarkHealthyOptions,
    ) => {
        if (options?.preservePendingRetry && hasPendingRetry(channel)) {
            console.info(`[Calendar] storage check passed (${source}) but retry is still pending`);
            return;
        }
        const state = get();
        const wasDegraded = state.storageStatus === 'degraded' || state.lastStorageError !== null;

        if (channel === 'all') {
            clearRetryState('events');
            clearRetryState('meta');
            channelErrors.events = null;
            channelErrors.meta = null;
        } else {
            clearRetryState(channel);
            channelErrors[channel] = null;
        }

        const remainingError = getFirstChannelError();
        if (remainingError) {
            set((prev) => ({
                storageStatus: 'degraded',
                lastStorageError: remainingError,
                lastStorageErrorAt: prev.lastStorageErrorAt ?? Date.now(),
            }));
            return;
        }

        set({
            storageStatus: 'healthy',
            lastStorageError: null,
            lastStorageErrorAt: null,
        });
        if (wasDegraded) {
            showStorageToast('Calendar storage recovered. Pending changes were saved.', 'success', true);
        }
        console.info(`[Calendar] storage healthy (${source})`);
    };

    const markStorageDegraded = (source: string, error: unknown, channel: RetryChannel) => {
        const message = `${source}: ${formatStorageError(error)}`;
        channelErrors[channel] = message;
        console.error('[Calendar] storage degraded:', message, error);
        set({
            storageStatus: 'degraded',
            lastStorageError: message,
            lastStorageErrorAt: Date.now(),
        });
        showStorageToast('Calendar storage is temporarily unavailable. Changes will auto-retry.', 'error');
    };

    const scheduleRetry = (channel: RetryChannel, task: () => Promise<void>) => {
        const slot = retryStates[channel];
        slot.task = task;

        if (slot.attempts >= MAX_RETRY_ATTEMPTS) {
            showStorageToast('Calendar storage still failing. Please check disk permissions.', 'warning');
            return;
        }

        if (slot.timer) {
            return;
        }

        const delay = getRetryDelay(slot.attempts);
        slot.attempts += 1;
        slot.timer = setTimeout(() => {
            slot.timer = null;
            const retryTask = slot.task;
            slot.task = null;
            if (!retryTask) {
                return;
            }
            void retryTask();
        }, delay);
    };

    const persistCalendarsMetaSafely = async (calendars: NekoCalendar[]) => {
        try {
            await saveCalendarsMeta(calendars);
            markStorageHealthy('saveCalendarsMeta', 'meta');
        } catch (error) {
            markStorageDegraded('saveCalendarsMeta', error, 'meta');
            scheduleRetry('meta', async () => {
                await persistCalendarsMetaSafely(get().calendars);
            });
        }
    };

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
                const effectiveCalendars = calendars.length > 0 ? calendars : [DEFAULT_MAIN_CALENDAR];
                set({ calendars: effectiveCalendars, events, loaded: true });
                markStorageHealthy('load', 'all', { preservePendingRetry: true });
            } catch (error) {
                markStorageDegraded('load', error, 'events');
                set((state) => ({
                    loaded: true,
                    calendars: state.calendars.length > 0 ? state.calendars : [DEFAULT_MAIN_CALENDAR],
                }));
            }
        },

        save: async () => {
            const { calendars, events } = get();
            try {
                await saveAllEvents(events, calendars);
                markStorageHealthy('saveAllEvents', 'events');
            } catch (error) {
                markStorageDegraded('saveAllEvents', error, 'events');
                scheduleRetry('events', async () => {
                    await get().save();
                });
            }
        },

        runStorageHealthCheck: async () => {
            try {
                const calendars = await loadCalendarsMeta();
                const events = await loadAllEvents();
                if (calendars.length === 0) {
                    throw new Error('No calendar metadata found');
                }
                const calendarIds = new Set(calendars.map((c) => c.id));
                const orphaned = events.find((e) => !calendarIds.has(e.calendarId));
                if (orphaned) {
                    throw new Error(`Found orphan event: ${orphaned.uid}`);
                }
                markStorageHealthy('health-check', 'all', { preservePendingRetry: true });
                return true;
            } catch (error) {
                markStorageDegraded('health-check', error, 'events');
                return false;
            }
        },

        addEvent: async (eventData) => {
            const newEvent: NekoEvent = {
                ...eventData,
                uid: eventData.uid || crypto.randomUUID(),
                color: eventData.color || DEFAULT_COLOR,
                scheduled: eventData.scheduled ?? true,
            };

            set((state) => ({
                events: [...state.events, newEvent],
            }));

            await get().save();
        },

        updateEvent: async (uid, updates, options) => {
            const normalizedUpdates: Partial<NekoEvent> = { ...updates };
            const shouldUnschedule = ('dtstart' in normalizedUpdates && normalizedUpdates.dtstart === undefined)
                || ('dtend' in normalizedUpdates && normalizedUpdates.dtend === undefined);
            if (shouldUnschedule) {
                delete normalizedUpdates.dtstart;
                delete normalizedUpdates.dtend;
                normalizedUpdates.scheduled = false;
            } else if (
                ('dtstart' in normalizedUpdates && normalizedUpdates.dtstart instanceof Date)
                || ('dtend' in normalizedUpdates && normalizedUpdates.dtend instanceof Date)
            ) {
                normalizedUpdates.scheduled = true;
            }

            set((state) => ({
                events: state.events.map((e) =>
                    e.uid === uid ? { ...e, ...normalizedUpdates } : e
                ),
            }));
            if (options?.persist ?? true) {
                await get().save();
            }
        },

        deleteEvent: async (uid) => {
            set((state) => ({
                events: state.events.filter((e) => e.uid !== uid),
            }));

            await get().save();
        },

        deleteCompletedEventsInCalendar: async (calendarId) => {
            set((state) => ({
                events: state.events.filter((e) => !(e.calendarId === calendarId && e.completed)),
            }));
            await get().save();
        },

        addTask: async (content, groupId, calendarId, color, tags) => {
            const state = get();
            const targetCalendarId = calendarId || state.calendars[0]?.id || 'main';
            const normalizedTags = normalizeTags(tags);

            const groupTasks = getChildren(state.events, null, groupId);

            const newEvent: NekoEvent = {
                uid: crypto.randomUUID(),
                summary: content,
                dtstart: new Date(),
                dtend: new Date(Date.now() + 15 * 60 * 1000),
                scheduled: false,
                allDay: false,
                calendarId: targetCalendarId,
                groupId: groupId,
                order: groupTasks.length,
                color: color || DEFAULT_COLOR,
                tags: normalizedTags.length > 0 ? normalizedTags : undefined,
                completed: false,
                estimatedMinutes: 15,
            };

            await get().addEvent(newEvent);
        },

        addSubTask: async (parentId, content) => {
            const state = get();
            const parent = state.events.find((e) => e.uid === parentId);
            if (!parent) return;

            const siblings = getChildren(state.events, parentId);

            const newEvent: NekoEvent = {
                uid: crypto.randomUUID(),
                summary: content,
                dtstart: new Date(),
                dtend: new Date(Date.now() + 15 * 60 * 1000),
                scheduled: false,
                allDay: false,
                calendarId: parent.calendarId,
                groupId: parent.groupId,
                parentId: parentId,
                order: siblings.length,
                color: parent.color,
                completed: false,
                estimatedMinutes: 15,
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

            await get().save();
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

            await get().save();
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
                markStorageHealthy('addCalendar', 'meta');
            } catch (error) {
                markStorageDegraded('addCalendar', error, 'meta');
                throw error;
            }
        },

        updateCalendar: async (id, updates) => {
            try {
                await updateCalendarInStorage(id, updates);
                const nextCalendars = get().calendars.map((c) =>
                    c.id === id ? { ...c, ...updates } : c
                );
                set({ calendars: nextCalendars });
                markStorageHealthy('updateCalendar', 'meta');
            } catch (error) {
                markStorageDegraded('updateCalendar', error, 'meta');
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
                markStorageHealthy('deleteCalendar', 'meta');
            } catch (error) {
                markStorageDegraded('deleteCalendar', error, 'meta');
                throw error;
            }
        },

        toggleCalendarVisibility: (id) => {
            const nextCalendars = get().calendars.map((c) =>
                c.id === id ? { ...c, visible: !c.visible } : c
            );
            set({ calendars: nextCalendars });
            void persistCalendarsMetaSafely(nextCalendars);
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
