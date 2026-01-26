// Group Store - Adapter layer: UnifiedTask -> NekoEvent (ICS)
// This effectively replaces the old JSON-based store with the ICS-based calendar store.

import { useCalendarEventsStore } from './calendarEventsSlice';
import { useUIStore } from './uiSlice';
import { DEFAULT_GROUP_ID, DEFAULT_GROUP_NAME } from '@/lib/config';
import type { Task, Group, ItemColor } from './types';
import type { NekoEvent, NekoCalendar } from '@/lib/ics/types';

export type { Task, Group, ItemColor };
export { useUIStore };

/**
 * Adapter: Convert NekoEvent (ICS) to Task (UI)
 */
function eventToTask(event: NekoEvent): Task {
  // Use calendarId as groupId
  // Use uid as id
  // Use summary as content
  // Provide defaults for missing fields
  return {
    ...event,
    id: event.uid,
    content: event.summary,
    groupId: event.calendarId,
    // Ensure all required Task fields are present
    completed: event.completed ?? false,
    createdAt: event.dtstart ? new Date(event.dtstart).getTime() : Date.now(),
    order: event.order ?? 0,
    parentId: event.parentId ?? null,
    collapsed: event.collapsed ?? false,
    color: event.color || 'default',
    startDate: event.dtstart ? new Date(event.dtstart).getTime() : undefined,
    endDate: event.dtend ? new Date(event.dtend).getTime() : undefined,
    isAllDay: event.allDay,
    
    // Timer fields mapping
    timerState: event.timerState,
    timerStartedAt: event.timerStartedAt,
    timerAccumulated: event.timerAccumulated,
    
    // Meta
    estimatedMinutes: event.estimatedMinutes,
    icon: event.icon,
    iconSize: event.iconSize,
    description: event.description,
    location: event.location,
  } as unknown as Task; // Cast because types aren't 100% identical but compatible enough for UI
}

/**
 * Adapter: Convert NekoCalendar (ICS) to Group (UI)
 */
function calendarToGroup(cal: NekoCalendar): Group {
  return {
    id: cal.id,
    name: cal.name,
    icon: undefined, // Calendars don't strictly have icons yet, maybe in X-props later
    pinned: false,   // Not supported in current ICS schema, could add X-NEKO-PINNED
    createdAt: Date.now(), // Not stored in ICS
    updatedAt: Date.now(),
  };
}

export function useGroupStore() {
  const eventStore = useCalendarEventsStore();

  // Create derived state
  // This might be slightly expensive on every render if event count is huge.
  // Performance Optimization: In a real large app, we'd use memoization or a computed store.
  // For now, mapping a few hundred events is negligible.
  const groups: Group[] = eventStore.calendars.map(calendarToGroup);
  const tasks: Task[] = eventStore.events.map(eventToTask);
  
  // Ensure default group exists if no calendars
  if (groups.length === 0) {
    groups.push({
      id: DEFAULT_GROUP_ID,
      name: DEFAULT_GROUP_NAME,
      pinned: false,
      createdAt: Date.now()
    });
  }

  return {
    groups,
    tasks,
    loaded: eventStore.loaded,
    activeGroupId: DEFAULT_GROUP_ID, // TODO: Manage active group state in UIStore or local state

    // --- Actions Mapping ---

    setActiveGroup: (_id: string | null) => {
        // This was previously in UnifiedStore. 
        // We might need to handle this state if components rely on it being global.
        // For now, let's just log it or no-op if it's purely visual.
    },

    addGroup: async (name: string) => {
        await eventStore.addCalendar(name, 'blue');
    },

    updateGroup: async (id: string, name: string, _icon?: string) => {
        await eventStore.updateCalendar(id, { name });
    },

    deleteGroup: async (id: string) => {
        await eventStore.deleteCalendar(id);
    },

    togglePin: (_id: string) => {
        console.warn('Pinning groups not yet supported in ICS backend');
    },

    reorderGroups: (_activeId: string, _overId: string) => {
        console.warn('Reordering groups not yet supported in ICS backend');
    },

    // --- Task Actions ---

    addTask: async (content: string, groupId: string, _color?: ItemColor) => {
        await eventStore.addTask(content, groupId);
    },

    addSubTask: async (parentId: string, content: string) => {
        await eventStore.addSubTask(parentId, content);
    },

    updateTask: async (id: string, content: string) => {
        await eventStore.updateEvent(id, { summary: content });
    },

    updateTaskEstimation: async (id: string, estimatedMinutes?: number) => {
        await eventStore.updateEvent(id, { estimatedMinutes });
    },

    updateTaskColor: async (id: string, color: ItemColor) => {
        await eventStore.updateEvent(id, { color });
    },

    updateTaskIcon: async (id: string, icon?: string) => {
        await eventStore.updateEvent(id, { icon });
    },

    updateTaskParent: async (id: string, parentId: string | null, order: number) => {
        await eventStore.updateEvent(id, { parentId: parentId || undefined, order });
    },

    updateTaskTime: async (id: string, startDate?: number | null, endDate?: number | null, isAllDay?: boolean) => {
        const updates: Partial<NekoEvent> = {};
        if (startDate !== undefined) updates.dtstart = startDate ? new Date(startDate) : undefined;
        if (endDate !== undefined) updates.dtend = endDate ? new Date(endDate) : undefined;
        if (isAllDay !== undefined) updates.allDay = isAllDay;
        
        await eventStore.updateEvent(id, updates);
    },

    toggleTask: async (id: string) => {
        eventStore.toggleComplete(id);
    },

    toggleCollapse: async (id: string) => {
        eventStore.toggleTaskCollapse(id);
    },

    deleteTask: async (id: string) => {
        await eventStore.deleteEvent(id);
    },

    deleteCompletedTasks: async (groupId: string) => {
        await deleteCompletedTasks(groupId);
    },

    reorderTasks: async (activeId: string, overId: string) => {
        await eventStore.updateTaskOrder(activeId, overId);
    },

    moveTaskToGroup: async (taskId: string, targetGroupId: string, overTaskId?: string | null) => {
        await eventStore.moveTaskToGroup(taskId, targetGroupId, overTaskId);
    },

    archiveCompletedTasks: async (groupId: string) => {
        console.warn('Archive not yet implemented in ICS backend - deleting for now');
        await deleteCompletedTasks(groupId); 
    },

    loadData: eventStore.load,
  };
}

// Helper to implement deleteCompletedTasks recursively if needed
async function deleteCompletedTasks(groupId: string) {
    const store = useCalendarEventsStore.getState();
    const tasksToDelete = store.events.filter(e => e.calendarId === groupId && e.completed);
    for (const task of tasksToDelete) {
        await store.deleteEvent(task.uid);
    }
}

// State Accessor for non-hook usage (legacy support)
useGroupStore.getState = () => {
  const store = useCalendarEventsStore.getState();
  const tasks = store.events.map(eventToTask);
  const groups = store.calendars.map(calendarToGroup);
  
  return {
    groups,
    tasks,
    loaded: store.loaded,
    activeGroupId: DEFAULT_GROUP_ID,
    // Provide no-op or real implementations for these helpers if accessed via getState
    updateTaskParent: async (id: string, parentId: string | null, order: number) => {
        await store.updateEvent(id, { parentId: parentId || undefined, order });
    },
    updateTaskColor: async (id: string, color: ItemColor) => {
        await store.updateEvent(id, { color });
    },
    updateTaskEstimation: async (id: string, min: number) => {
        await store.updateEvent(id, { estimatedMinutes: min });
    },
    updateTaskIcon: async (id: string, icon: string) => {
        await store.updateEvent(id, { icon });
    },
  };
};

export type GroupStore = ReturnType<typeof useGroupStore>;
