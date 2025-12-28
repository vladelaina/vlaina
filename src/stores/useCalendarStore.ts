/**
 * Calendar Store - Calendar view data access layer
 * 
 * Core concept: There is only one type of "item" (UnifiedTask)
 * - Items with time properties appear in calendar view
 * - Items without time properties only appear in todo view
 * - Calendar and todo are just different windows observing the same data
 */

import { useUnifiedStore } from './useUnifiedStore';
import type { UnifiedTask } from '@/lib/storage/unifiedStorage';
import { DEFAULT_COLOR } from '@/lib/colors';

// 从统一类型模块导入，保持向后兼容的 re-export
import type { CalendarEvent, TimeView } from './types';

export type { CalendarEvent, TimeView };

/**
 * Convert UnifiedTask to CalendarEvent view format
 */
function toCalendarEvent(task: UnifiedTask): CalendarEvent {
  return {
    id: task.id,
    content: task.content,
    startDate: task.startDate!,
    endDate: task.endDate || task.startDate! + 60 * 60 * 1000,
    isAllDay: task.isAllDay || false,
    color: task.color || DEFAULT_COLOR,
    completed: task.completed,
    description: task.description,
    location: task.location,
    groupId: task.groupId,
  };
}

/**
 * Calendar view data access hook
 * 
 * Filters items with time properties from unified tasks
 * Provides all state and operations needed for calendar view
 */
export function useCalendarStore() {
  const store = useUnifiedStore();
  
  // Filter items with time properties from tasks
  const calendarEvents = store.data.tasks
    .filter(t => t.startDate !== undefined)
    .map(toCalendarEvent);
  
  return {
    // Data - calendar events (tasks with time properties)
    events: calendarEvents,
    groups: store.data.groups,
    loaded: store.loaded,
    
    // View State
    viewMode: store.data.settings.viewMode,
    selectedDate: store.selectedDate,
    dayCount: store.data.settings.dayCount,
    showSidebar: store.showSidebar,
    showContextPanel: store.showContextPanel,
    editingEventId: store.editingEventId,
    editingEventPosition: store.editingEventPosition,
    selectedEventId: store.selectedEventId,
    timezone: store.data.settings.timezone,
    hourHeight: store.data.settings.hourHeight ?? 64,
    use24Hour: store.data.settings.use24Hour ?? false,
    dayStartTime: store.data.settings.dayStartTime ?? 300, // 默认 5:00 (300分钟)
    
    // Actions
    load: store.load,
    addEvent: store.addEvent,
    updateEvent: store.updateEvent,
    deleteEvent: store.deleteEvent,
    undo: store.undo,
    
    setViewMode: store.setViewMode,
    setSelectedDate: store.setSelectedDate,
    setDayCount: store.setDayCount,
    setHourHeight: store.setHourHeight,
    toggleSidebar: store.toggleSidebar,
    toggleContextPanel: store.toggleContextPanel,
    setEditingEventId: store.setEditingEventId,
    setSelectedEventId: store.setSelectedEventId,
    closeEditingEvent: store.closeEditingEvent,
    setTimezone: store.setTimezone,
    toggle24Hour: store.toggle24Hour,
    setDayStartTime: store.setDayStartTime,
    
    // Task operations (calendar events are essentially tasks)
    toggleTask: store.toggleTask,
    updateTaskColor: store.updateTaskColor,
    
    // Timer operations
    startTimer: store.startTimer,
    pauseTimer: store.pauseTimer,
    resumeTimer: store.resumeTimer,
    stopTimer: store.stopTimer,
  };
}
