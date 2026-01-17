/**
 * Calendar Events Slice - Zustand store for ICS-based calendar events
 * 
 * This is the new calendar data layer that uses ICS files instead of the unified JSON store.
 */

import { create } from 'zustand';
import type { NekoEvent, NekoCalendar } from '@/lib/ics/types';
import type { ItemColor } from '@/lib/colors';
import { DEFAULT_COLOR } from '@/lib/colors';
import {
    loadCalendarsMeta,
    saveCalendarsMeta,
    loadAllEvents,
    saveAllEvents,
    addCalendar as addCalendarToStorage,
    deleteCalendar as deleteCalendarFromStorage,
    updateCalendar as updateCalendarInStorage,
} from '@/lib/storage/calendarStorage';

interface CalendarEventsState {
    // Data
    calendars: NekoCalendar[];
    events: NekoEvent[];
    loaded: boolean;

    // Actions
    load: () => Promise<void>;
    save: () => Promise<void>;

    // Event CRUD
    addEvent: (event: Omit<NekoEvent, 'uid'> & { uid?: string }) => Promise<void>;
    updateEvent: (uid: string, updates: Partial<NekoEvent>) => Promise<void>;
    deleteEvent: (uid: string) => Promise<void>;

    // Calendar CRUD
    addCalendar: (name: string, color: ItemColor) => Promise<void>;
    updateCalendar: (id: string, updates: Partial<Pick<NekoCalendar, 'name' | 'color' | 'visible'>>) => Promise<void>;
    deleteCalendar: (id: string) => Promise<void>;
    toggleCalendarVisibility: (id: string) => void;

    // Timer Actions
    startTimer: (uid: string) => void;
    pauseTimer: (uid: string) => void;
    resumeTimer: (uid: string) => void;
    stopTimer: (uid: string) => void;

    // Toggle complete
    toggleComplete: (uid: string) => void;
}

// Debounced save
let saveTimeout: ReturnType<typeof setTimeout> | null = null;

export const useCalendarEventsStore = create<CalendarEventsState>()((set, get) => ({
    calendars: [],
    events: [],
    loaded: false,

    load: async () => {
        try {
            const calendars = await loadCalendarsMeta();
            const events = await loadAllEvents();

            set({ calendars, events, loaded: true });
            console.log('[CalendarEventsStore] Loaded events:', events.length);
        } catch (error) {
            console.error('[CalendarEventsStore] Failed to load:', error);
            set({ loaded: true });
        }
    },

    save: async () => {
        // Clear any pending debounced save
        if (saveTimeout) {
            clearTimeout(saveTimeout);
            saveTimeout = null;
        }

        const { calendars, events } = get();
        await saveCalendarsMeta(calendars);
        await saveAllEvents(events, calendars);
    },

    addEvent: async (eventData) => {
        const newEvent: NekoEvent = {
            ...eventData,
            uid: eventData.uid || crypto.randomUUID(),
            color: eventData.color || DEFAULT_COLOR,
        };

        console.log('[CalendarEventsStore] Adding event:', newEvent.uid, newEvent);

        set(state => ({
            events: [...state.events, newEvent],
        }));

        await get().save();
    },

    updateEvent: async (uid, updates) => {
        set(state => ({
            events: state.events.map(e =>
                e.uid === uid ? { ...e, ...updates } : e
            ),
        }));

        await get().save();
    },

    deleteEvent: async (uid) => {
        console.log('[CalendarEventsStore] Deleting event:', uid);
        console.log('[CalendarEventsStore] Stack trace:', new Error().stack);

        set(state => ({
            events: state.events.filter(e => e.uid !== uid),
        }));

        await get().save();
    },

    addCalendar: async (name, color) => {
        const newCalendar = await addCalendarToStorage(name, color);
        set(state => ({
            calendars: [...state.calendars, newCalendar],
        }));
    },

    updateCalendar: async (id, updates) => {
        await updateCalendarInStorage(id, updates);
        set(state => ({
            calendars: state.calendars.map(c =>
                c.id === id ? { ...c, ...updates } : c
            ),
        }));
    },

    deleteCalendar: async (id) => {
        await deleteCalendarFromStorage(id);
        set(state => ({
            calendars: state.calendars.filter(c => c.id !== id),
            events: state.events.filter(e => e.calendarId !== id),
        }));
    },

    toggleCalendarVisibility: (id) => {
        set(state => ({
            calendars: state.calendars.map(c =>
                c.id === id ? { ...c, visible: !c.visible } : c
            ),
        }));
        get().save();
    },

    startTimer: (uid) => {
        set(state => ({
            events: state.events.map(e =>
                e.uid === uid
                    ? { ...e, timerState: 'running' as const, timerStartedAt: Date.now() }
                    : e
            ),
        }));
        get().save();
    },

    pauseTimer: (uid) => {
        const event = get().events.find(e => e.uid === uid);
        if (!event || event.timerState !== 'running') return;

        const elapsed = event.timerStartedAt ? Date.now() - event.timerStartedAt : 0;
        const accumulated = (event.timerAccumulated || 0) + elapsed;

        set(state => ({
            events: state.events.map(e =>
                e.uid === uid
                    ? { ...e, timerState: 'paused' as const, timerAccumulated: accumulated, timerStartedAt: undefined }
                    : e
            ),
        }));
        get().save();
    },

    resumeTimer: (uid) => {
        set(state => ({
            events: state.events.map(e =>
                e.uid === uid
                    ? { ...e, timerState: 'running' as const, timerStartedAt: Date.now() }
                    : e
            ),
        }));
        get().save();
    },

    stopTimer: (uid) => {
        const event = get().events.find(e => e.uid === uid);
        if (!event) return;

        let finalAccumulated = event.timerAccumulated || 0;
        if (event.timerState === 'running' && event.timerStartedAt) {
            finalAccumulated += Date.now() - event.timerStartedAt;
        }

        set(state => ({
            events: state.events.map(e =>
                e.uid === uid
                    ? { ...e, timerState: 'idle' as const, timerAccumulated: finalAccumulated, timerStartedAt: undefined }
                    : e
            ),
        }));
        get().save();
    },

    toggleComplete: (uid) => {
        set(state => ({
            events: state.events.map(e =>
                e.uid === uid ? { ...e, completed: !e.completed } : e
            ),
        }));
        get().save();
    },
}));
