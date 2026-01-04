// Calendar Store - Calendar view data access layer

import { useUnifiedStore } from './useUnifiedStore';
import { useUIStore } from './uiSlice';
import { toCalendarDisplayItems } from '@/lib/calendar';
import { 
  DEFAULT_HOUR_HEIGHT, 
  DEFAULT_USE_24_HOUR, 
  DEFAULT_DAY_START_TIME,
} from '@/lib/config';

import type { CalendarEvent, CalendarDisplayItem, TimeView } from './types';

export type { CalendarEvent, CalendarDisplayItem, TimeView };

export function useCalendarStore() {
  const store = useUnifiedStore();
  const uiStore = useUIStore();
  
  const calendarEvents = toCalendarDisplayItems(store.data.tasks);
  
  return {
    events: calendarEvents,
    groups: store.data.groups,
    loaded: store.loaded,
    
    viewMode: store.data.settings.viewMode,
    dayCount: store.data.settings.dayCount,
    timezone: store.data.settings.timezone,
    hourHeight: store.data.settings.hourHeight ?? DEFAULT_HOUR_HEIGHT,
    use24Hour: store.data.settings.use24Hour ?? DEFAULT_USE_24_HOUR,
    dayStartTime: store.data.settings.dayStartTime ?? DEFAULT_DAY_START_TIME,
    
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
    
    setSelectedDate: uiStore.setSelectedDate,
    toggleSidebar: uiStore.toggleSidebar,
    toggleContextPanel: uiStore.toggleContextPanel,
    setEditingEventId: uiStore.setEditingEventId,
    setSelectedEventId: uiStore.setSelectedEventId,
    closeEditingEvent: uiStore.closeEditingEvent,
    
    toggleTask: store.toggleTask,
    updateTaskColor: store.updateTaskColor,
    updateTaskIcon: store.updateTaskIcon,
    
    startTimer: store.startTimer,
    pauseTimer: store.pauseTimer,
    resumeTimer: store.resumeTimer,
    stopTimer: store.stopTimer,
  };
}
