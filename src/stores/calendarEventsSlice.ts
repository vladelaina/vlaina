import { create } from 'zustand';
import type { NekoEvent, NekoCalendar } from '@/lib/ics/types';
import type { ItemColor } from '@/lib/colors';
import { DEFAULT_COLOR } from '@/lib/colors';
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

interface CalendarEventsState {
    calendars: NekoCalendar[];
    events: NekoEvent[];
    loaded: boolean;

    load: () => Promise<void>;
    save: () => Promise<void>;

    addEvent: (event: Omit<NekoEvent, 'uid'> & { uid?: string }) => Promise<void>;
    updateEvent: (uid: string, updates: Partial<NekoEvent>) => Promise<void>;
    deleteEvent: (uid: string) => Promise<void>;

    addTask: (content: string, groupId: string, calendarId?: string) => Promise<void>;
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

export const useCalendarEventsStore = create<CalendarEventsState>()((set, get) => ({
    calendars: [],
    events: [],
    loaded: false,

    load: async () => {
        try {
            const calendars = await loadCalendarsMeta();
            const events = await loadAllEvents();

            set({ calendars, events, loaded: true });

        } catch (error) {
            set({ loaded: true });
        }
    },

    save: async () => {
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
        set(state => ({
            events: state.events.filter(e => e.uid !== uid),
        }));

        await get().save();
    },

    addTask: async (content, groupId, calendarId) => {
        const state = get();
        const targetCalendarId = calendarId || state.calendars[0]?.id || 'main';
        
        const groupTasks = getChildren(state.events, null, groupId);
        
        const newEvent: NekoEvent = {
            uid: crypto.randomUUID(),
            summary: content,
            dtstart: new Date(),
            dtend: new Date(Date.now() + 15*60*1000),
            allDay: false,
            calendarId: targetCalendarId,
            groupId: groupId,
            order: groupTasks.length,
            completed: false,
            estimatedMinutes: 15,
        };

        await get().addEvent(newEvent);
    },

    addSubTask: async (parentId, content) => {
        const state = get();
        const parent = state.events.find(e => e.uid === parentId);
        if (!parent) return;

        const siblings = getChildren(state.events, parentId);
        
        const newEvent: NekoEvent = {
            uid: crypto.randomUUID(),
            summary: content,
            dtstart: new Date(),
            dtend: new Date(Date.now() + 15*60*1000),
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
        const activeEvent = state.events.find(e => e.uid === activeId);
        const overEvent = state.events.find(e => e.uid === overId);

        if (!activeEvent || !overEvent) return;
        
        if (activeEvent.groupId !== overEvent.groupId) return;
        const activeParent = activeEvent.parentId || null;
        const overParent = overEvent.parentId || null;
        if (activeParent !== overParent) return;

        const siblings = getChildren(state.events, activeParent, activeEvent.groupId);
        const oldIndex = siblings.findIndex(e => e.uid === activeId);
        const newIndex = siblings.findIndex(e => e.uid === overId);

        if (oldIndex === -1 || newIndex === -1) return;

        const reorderedSiblings = reorderSiblings(siblings, oldIndex, newIndex);
        const orderMap = new Map(reorderedSiblings.map(e => [e.uid, e.order]));

        set(state => ({
            events: state.events.map(e => {
                if (orderMap.has(e.uid)) {
                    return { ...e, order: orderMap.get(e.uid) };
                }
                return e;
            })
        }));

        await get().save();
    },

    moveTaskToGroup: async (taskId, targetGroupId, overTaskId) => {
        const state = get();
        const task = state.events.find(e => e.uid === taskId);
        if (!task) return;

        const idsToMove = new Set(getDescendantIds(state.events, taskId));
        
        const targetTasks = getChildren(state.events, null, targetGroupId);
        let newOrder = targetTasks.length;

        if (overTaskId) {
            const overTask = state.events.find(e => e.uid === overTaskId);
            if (overTask && overTask.groupId === targetGroupId) {
                newOrder = overTask.order || 0;
            }
        }

        set(state => ({
            events: state.events.map(e => {
                if (e.uid === taskId) {
                    return { ...e, groupId: targetGroupId, order: newOrder, parentId: undefined };
                }
                if (idsToMove.has(e.uid)) {
                    return { ...e, groupId: targetGroupId };
                }
                return e;
            })
        }));

        await get().save();
    },

    toggleTaskCollapse: async (uid) => {
        const event = get().events.find(e => e.uid === uid);
        if (!event) return;
        
        await get().updateEvent(uid, { collapsed: !event.collapsed });
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
