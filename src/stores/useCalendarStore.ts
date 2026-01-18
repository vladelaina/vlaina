/**
 * Calendar Store - Calendar view data access layer
 * 
 * Uses ICS-based events from calendarEventsSlice.
 * All components use NekoEvent directly - no compatibility layer.
 */

import { useCalendarEventsStore } from './calendarEventsSlice';
import { useUnifiedStore } from './useUnifiedStore';
import { useUIStore } from './uiSlice';
import {
  DEFAULT_HOUR_HEIGHT,
  DEFAULT_USE_24_HOUR,
  DEFAULT_DAY_START_TIME,
} from '@/lib/config';

import type { TimeView } from './types';
import type { NekoEvent, NekoCalendar } from '@/lib/ics/types';
import type { ItemColor } from '@/lib/colors';

// Export types - NekoEvent is the canonical event type
export type { NekoEvent, NekoCalendar };
export type { TimeView };

// Legacy alias for gradual migration
// CalendarEvent alias removed - use NekoEvent

import { useCallback } from 'react';

export function useCalendarStore() {
  const eventsStore = useCalendarEventsStore();
  const settingsStore = useUnifiedStore();
  const uiStore = useUIStore();

  // Filter visible calendar events
  const visibleCalendarIds = new Set(
    eventsStore.calendars.filter(c => c.visible).map(c => c.id)
  );

  if (uiStore.editingEventId) {
    // Debug logs removed
  }

  // Always include the event being edited, regardless of calendar visibility
  const calendarEvents = eventsStore.events.filter(e =>
    visibleCalendarIds.has(e.calendarId) || e.uid === uiStore.editingEventId
  );

  // Memoized actions
  const load = useCallback(async () => {
    await settingsStore.load();
    await eventsStore.load();
  }, [settingsStore.load, eventsStore.load]);

  const addEvent = useCallback((eventData: Omit<NekoEvent, 'uid' | 'calendarId'> & { uid?: string, calendarId?: string }): string => {
    const uid = eventData.uid || crypto.randomUUID();

    // Find a suitable calendar
    const targetCalendarId = eventData.calendarId ||
      eventsStore.calendars.find(c => c.visible)?.id ||
      eventsStore.calendars[0]?.id ||
      'personal';

    // Ensure the target calendar is visible so the user doesn't lose track of the new event
    const targetCalendar = eventsStore.calendars.find(c => c.id === targetCalendarId);
    if (targetCalendar && !targetCalendar.visible) {
      eventsStore.toggleCalendarVisibility(targetCalendarId);
    }

    eventsStore.addEvent({
      ...eventData,
      uid,
      calendarId: targetCalendarId,
    } as NekoEvent);
    return uid;
  }, [eventsStore.calendars, eventsStore.addEvent, eventsStore.toggleCalendarVisibility]);

  const updateEvent = useCallback((uid: string, updates: Partial<NekoEvent>) => {
    eventsStore.updateEvent(uid, updates);
  }, [eventsStore.updateEvent]);

  return {
    // Events and Calendars - direct NekoEvent[]
    events: calendarEvents,
    allEvents: eventsStore.events, // Export raw events for editing lookup
    calendars: eventsStore.calendars,
    loaded: eventsStore.loaded,

    // Settings (still from unified store for now)
    viewMode: settingsStore.data.settings.viewMode,
    dayCount: settingsStore.data.settings.dayCount,
    timezone: settingsStore.data.settings.timezone,
    hourHeight: settingsStore.data.settings.hourHeight ?? DEFAULT_HOUR_HEIGHT,
    use24Hour: settingsStore.data.settings.use24Hour ?? DEFAULT_USE_24_HOUR,
    dayStartTime: settingsStore.data.settings.dayStartTime ?? DEFAULT_DAY_START_TIME,

    // UI State
    selectedDate: uiStore.selectedDate,
    showSidebar: !uiStore.sidebarCollapsed,
    showContextPanel: uiStore.showContextPanel,
    editingEventId: uiStore.editingEventId,
    editingEventPosition: uiStore.editingEventPosition,
    selectedEventId: uiStore.selectedEventId,
    // Legacy preview state (deprecated)
    previewIconEventId: uiStore.previewIconEventId,
    previewIcon: uiStore.previewIcon,
    previewColorEventId: uiStore.previewColorEventId,
    previewColor: uiStore.previewColor,
    // Universal preview state
    universalPreviewTarget: uiStore.universalPreviewTarget,
    universalPreviewIcon: uiStore.universalPreviewIcon,
    universalPreviewColor: uiStore.universalPreviewColor,

    // Load
    load,

    // Event Actions
    addEvent,
    updateEvent,

    deleteEvent: eventsStore.deleteEvent,

    // Calendar management
    addCalendar: eventsStore.addCalendar,
    updateCalendar: eventsStore.updateCalendar,
    deleteCalendar: eventsStore.deleteCalendar,
    toggleCalendarVisibility: eventsStore.toggleCalendarVisibility,

    // Settings actions
    setViewMode: settingsStore.setViewMode,
    setDayCount: settingsStore.setDayCount,
    setHourHeight: settingsStore.setHourHeight,
    setTimezone: settingsStore.setTimezone,
    toggle24Hour: settingsStore.toggle24Hour,
    setDayStartTime: settingsStore.setDayStartTime,

    // UI actions
    setSelectedDate: uiStore.setSelectedDate,
    toggleSidebar: uiStore.toggleSidebar,
    toggleContextPanel: uiStore.toggleContextPanel,
    setEditingEventId: uiStore.setEditingEventId,
    setSelectedEventId: uiStore.setSelectedEventId,
    closeEditingEvent: uiStore.closeEditingEvent,

    // Event-specific actions
    toggleComplete: eventsStore.toggleComplete,
    updateEventColor: (uid: string, color: ItemColor) => eventsStore.updateEvent(uid, { color }),
    updateEventIcon: (uid: string, icon: string | undefined) => eventsStore.updateEvent(uid, { icon }),

    // Timer actions
    startTimer: eventsStore.startTimer,
    pauseTimer: eventsStore.pauseTimer,
    resumeTimer: eventsStore.resumeTimer,
    stopTimer: eventsStore.stopTimer,
  };
}
