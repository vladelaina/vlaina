import { useCalendarEventsStore } from './calendarEventsSlice';
import { useUIStore } from './uiSlice';
import { DEFAULT_GROUP_ID, DEFAULT_GROUP_NAME } from '@/lib/config';
import { formatDateKey } from '@/lib/date';
import type { ItemColor } from './types';
import type { NekoEvent, NekoCalendar } from '@/lib/ics/types';

export type { ItemColor, NekoEvent, NekoCalendar };
export { useUIStore };

export function useGroupStore() {
  const eventStore = useCalendarEventsStore();
  const uiStore = useUIStore();

  const calendars = eventStore.calendars.length > 0 
    ? eventStore.calendars 
    : [{
        id: DEFAULT_GROUP_ID,
        name: DEFAULT_GROUP_NAME,
        color: 'blue' as ItemColor,
        visible: true,
      }];

  return {
    calendars,
    tasks: eventStore.events,
    loaded: eventStore.loaded,
    activeGroupId: uiStore.activeGroupId,

    setActiveGroup: (id: string | null) => {
        uiStore.setActiveGroupId(id || DEFAULT_GROUP_ID);
    },

    togglePin: (_id: string) => {
    },

    reorderGroups: (_activeId: string, _overId: string) => {
    },

    addTask: async (summary: string, groupId: string, color?: ItemColor, tags?: string[]) => {
        await eventStore.addTask(summary, groupId, undefined, color, tags);
    },

    addSubTask: async (parentId: string, summary: string) => {
        await eventStore.addSubTask(parentId, summary);
    },

    updateTask: async (uid: string, summary: string) => {
        await eventStore.updateEvent(uid, { summary });
    },

    updateTaskEstimation: async (uid: string, estimatedMinutes?: number) => {
        await eventStore.updateEvent(uid, { estimatedMinutes });
    },

    updateTaskColor: async (uid: string, color: ItemColor) => {
        await eventStore.updateEvent(uid, { color });
    },

    updateTaskIcon: async (uid: string, icon?: string) => {
        await eventStore.updateEvent(uid, { icon });
    },

    updateTaskParent: async (uid: string, parentId: string | null, order: number) => {
        await eventStore.updateEvent(uid, { parentId: parentId || undefined, order });
    },

    updateTaskTime: async (uid: string, startDate?: number | null, endDate?: number | null, isAllDay?: boolean) => {
        const updates: Partial<NekoEvent> = {};
        if (startDate !== undefined) updates.dtstart = startDate ? new Date(startDate) : undefined;
        if (endDate !== undefined) updates.dtend = endDate ? new Date(endDate) : undefined;
        if (isAllDay !== undefined) updates.allDay = isAllDay;
        
        await eventStore.updateEvent(uid, updates);
    },

    toggleTask: async (uid: string) => {
        eventStore.toggleComplete(uid);
    },

    toggleCollapse: async (uid: string) => {
        eventStore.toggleTaskCollapse(uid);
    },

    deleteTask: async (uid: string) => {
        await eventStore.deleteEvent(uid);
    },

    deleteCompletedTasks: async (scopeId: string) => {
        await deleteCompletedTasks(scopeId);
    },

    reorderTasks: async (activeId: string, overId: string) => {
        await eventStore.updateTaskOrder(activeId, overId);
    },

    moveTaskToGroup: async (taskId: string, targetGroupId: string, overTaskId?: string | null) => {
        await eventStore.moveTaskToGroup(taskId, targetGroupId, overTaskId);
    },

    archiveCompletedTasks: async (scopeId: string) => {
        await deleteCompletedTasks(scopeId); 
    },

    loadData: eventStore.load,
  };
}

async function deleteCompletedTasks(scopeId: string) {
    const store = useCalendarEventsStore.getState();
    const selectedDate = useUIStore.getState().selectedDate;
    const selectedDateKey = formatDateKey(selectedDate);

    const tasksToDelete = store.events.filter(e => {
        if (!e.completed) return false;
        if (scopeId === '__archive__') return false;

        if (scopeId === 'all' || scopeId === 'completed' || scopeId === 'progress') {
            return true;
        }

        if (scopeId === 'today') {
            if (!e.dtstart) return false;
            return formatDateKey(new Date(e.dtstart)) === selectedDateKey;
        }

        return (e.groupId || DEFAULT_GROUP_ID) === scopeId;
    });

    for (const task of tasksToDelete) {
        await store.deleteEvent(task.uid);
    }
}

useGroupStore.getState = () => {
  const store = useCalendarEventsStore.getState();
  
  return {
    calendars: store.calendars,
    tasks: store.events,
    loaded: store.loaded,
    activeGroupId: DEFAULT_GROUP_ID,
    updateTaskParent: async (uid: string, parentId: string | null, order: number) => {
        await store.updateEvent(uid, { parentId: parentId || undefined, order });
    },
    updateTaskColor: async (uid: string, color: ItemColor) => {
        await store.updateEvent(uid, { color });
    },
    updateTaskEstimation: async (uid: string, min: number) => {
        await store.updateEvent(uid, { estimatedMinutes: min });
    },
    updateTaskIcon: async (uid: string, icon: string) => {
        await store.updateEvent(uid, { icon });
    },
  };
};

export type GroupStore = ReturnType<typeof useGroupStore>;
