/**
 * Calendar Store - Calendar view data access layer
 * 
 * Core concept: There is only one type of "item" (UnifiedTask)
 * - Items with time properties appear in calendar view
 * - Items without time properties only appear in todo view
 * - Calendar and todo are just different windows observing the same data
 * 
 * Architecture:
 * - Data state: 从 UnifiedStore 获取
 * - UI state: 委托到 UIStore（统一 UI 状态管理）
 */

import { useUnifiedStore } from './useUnifiedStore';
import { useUIStore } from './uiSlice';
import type { UnifiedTask } from '@/lib/storage/unifiedStorage';
import { DEFAULT_COLOR } from '@/lib/colors';
import { DEFAULT_EVENT_DURATION_MS } from '@/lib/calendar';
import { 
  DEFAULT_HOUR_HEIGHT, 
  DEFAULT_USE_24_HOUR, 
  DEFAULT_DAY_START_TIME,
} from '@/lib/config';

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
    endDate: task.endDate || task.startDate! + DEFAULT_EVENT_DURATION_MS,
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
 * 
 * UI state is delegated to UIStore for unified management
 */
export function useCalendarStore() {
  const store = useUnifiedStore();
  const uiStore = useUIStore();
  
  // Filter items with time properties from tasks
  const calendarEvents = store.data.tasks
    .filter(t => t.startDate !== undefined)
    .map(toCalendarEvent);
  
  return {
    // Data - calendar events (tasks with time properties)
    events: calendarEvents,
    groups: store.data.groups,
    loaded: store.loaded,
    
    // View State - 数据相关设置 (来自 UnifiedStore)
    viewMode: store.data.settings.viewMode,
    dayCount: store.data.settings.dayCount,
    timezone: store.data.settings.timezone,
    hourHeight: store.data.settings.hourHeight ?? DEFAULT_HOUR_HEIGHT,
    use24Hour: store.data.settings.use24Hour ?? DEFAULT_USE_24_HOUR,
    dayStartTime: store.data.settings.dayStartTime ?? DEFAULT_DAY_START_TIME,
    
    // UI State - 委托到 UIStore
    selectedDate: uiStore.selectedDate,
    showSidebar: uiStore.showSidebar,
    showContextPanel: uiStore.showContextPanel,
    editingEventId: uiStore.editingEventId,
    editingEventPosition: uiStore.editingEventPosition,
    selectedEventId: uiStore.selectedEventId,
    
    // Data Actions (来自 UnifiedStore)
    load: store.load,
    addEvent: store.addEvent,
    updateEvent: store.updateEvent,
    deleteEvent: store.deleteEvent,
    undo: store.undo,
    setViewMode: store.setViewMode,
    setDayCount: store.setDayCount,
    setHourHeight: store.setHourHeight,
    setTimezone: store.setTimezone,
    toggle24Hour: store.toggle24Hour,
    setDayStartTime: store.setDayStartTime,
    
    // UI Actions - 委托到 UIStore
    setSelectedDate: uiStore.setSelectedDate,
    toggleSidebar: uiStore.toggleSidebar,
    toggleContextPanel: uiStore.toggleContextPanel,
    setEditingEventId: uiStore.setEditingEventId,
    setSelectedEventId: uiStore.setSelectedEventId,
    closeEditingEvent: uiStore.closeEditingEvent,
    
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
