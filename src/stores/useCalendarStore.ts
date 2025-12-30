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
 * - 转换逻辑: 使用 @/lib/calendar 的统一转换函数
 */

import { useUnifiedStore } from './useUnifiedStore';
import { useUIStore } from './uiSlice';
import { toCalendarDisplayItems } from '@/lib/calendar';
import { 
  DEFAULT_HOUR_HEIGHT, 
  DEFAULT_USE_24_HOUR, 
  DEFAULT_DAY_START_TIME,
} from '@/lib/config';

// 从统一类型模块导入，保持向后兼容的 re-export
import type { CalendarEvent, CalendarDisplayItem, TimeView } from './types';

export type { CalendarEvent, CalendarDisplayItem, TimeView };

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
  
  // 使用统一的转换函数将任务转换为日历显示项
  const calendarEvents = toCalendarDisplayItems(store.data.tasks);
  
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
    previewIconEventId: uiStore.previewIconEventId,
    previewIcon: uiStore.previewIcon,
    previewColorEventId: uiStore.previewColorEventId,
    previewColor: uiStore.previewColor,
    
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
    updateTaskIcon: store.updateTaskIcon,
    
    // Timer operations
    startTimer: store.startTimer,
    pauseTimer: store.pauseTimer,
    resumeTimer: store.resumeTimer,
    stopTimer: store.stopTimer,
  };
}
