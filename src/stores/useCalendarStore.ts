/**
 * Calendar Store - Wrapper around UnifiedStore for backward compatibility
 * 
 * This store delegates all operations to useUnifiedStore while maintaining
 * the same API for existing components.
 */

import { useUnifiedStore } from './useUnifiedStore';
import type { UnifiedEvent } from '@/lib/storage/unifiedStorage';

// Re-export types
export type ViewMode = 'day' | 'week' | 'month';
export type CalendarEvent = UnifiedEvent;

// Custom hook that wraps UnifiedStore for calendar-specific data
export function useCalendarStore() {
  const store = useUnifiedStore();
  
  return {
    // Data (from unified store)
    events: store.data.events,
    loaded: store.loaded,
    
    // View State
    viewMode: store.data.settings.viewMode,
    selectedDate: store.selectedDate,
    dayCount: store.data.settings.dayCount,
    showSidebar: store.showSidebar,
    showContextPanel: store.showContextPanel,
    editingEventId: store.editingEventId,
    selectedEventId: store.selectedEventId,
    timezone: store.data.settings.timezone,
    hourHeight: store.data.settings.hourHeight ?? 64,
    
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
  };
}
