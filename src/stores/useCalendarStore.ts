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

export type { NekoEvent, NekoCalendar };
export type { TimeView };

import { useCallback } from 'react';

export function useCalendarStore() {
  const eventsStore = useCalendarEventsStore();
  const settingsStore = useUnifiedStore();
  const uiStore = useUIStore();

  const visibleCalendarIds = new Set(
    eventsStore.calendars.filter(c => c.visible).map(c => c.id)
  );

  if (uiStore.editingEventId) {
  }

  const calendarEvents = eventsStore.events.filter(e =>
    visibleCalendarIds.has(e.calendarId) || e.uid === uiStore.editingEventId
  );
  
  // 获取时区信息
  const timezone = settingsStore.data.settings.timezone.offset;
  const timezoneCity = settingsStore.data.settings.timezone.city;

  const load = useCallback(async () => {
    await settingsStore.load();
    await eventsStore.load();
  }, [settingsStore.load, eventsStore.load]);

  const addEvent = useCallback((eventData: Omit<NekoEvent, 'uid' | 'calendarId'> & { uid?: string, calendarId?: string }): string => {
    const uid = eventData.uid || crypto.randomUUID();

    const targetCalendarId = eventData.calendarId ||
      eventsStore.calendars.find(c => c.visible)?.id ||
      eventsStore.calendars[0]?.id ||
      'main';

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

  const updateEvent = useCallback((
    uid: string,
    updates: Partial<NekoEvent>,
    options?: { persist?: boolean }
  ) => {
    eventsStore.updateEvent(uid, updates, options);
  }, [eventsStore.updateEvent]);

  return {
    events: calendarEvents,
    allEvents: eventsStore.events,
    calendars: eventsStore.calendars,
    loaded: eventsStore.loaded,
    storageStatus: eventsStore.storageStatus,
    lastStorageError: eventsStore.lastStorageError,
    lastStorageErrorAt: eventsStore.lastStorageErrorAt,

    viewMode: settingsStore.data.settings.viewMode,
    dayCount: settingsStore.data.settings.dayCount,
    timezone,
    timezoneCity,
    hourHeight: settingsStore.data.settings.hourHeight ?? DEFAULT_HOUR_HEIGHT,
    use24Hour: settingsStore.data.settings.use24Hour ?? DEFAULT_USE_24_HOUR,
    dayStartTime: settingsStore.data.settings.dayStartTime ?? DEFAULT_DAY_START_TIME,

    selectedDate: uiStore.selectedDate,
    showSidebar: !uiStore.sidebarCollapsed,
    showContextPanel: uiStore.showContextPanel,
    editingEventId: uiStore.editingEventId,
    editingEventPosition: uiStore.editingEventPosition,
    selectedEventId: uiStore.selectedEventId,
    universalPreviewTarget: uiStore.universalPreviewTarget,
    universalPreviewIcon: uiStore.universalPreviewIcon,
    universalPreviewColor: uiStore.universalPreviewColor,
    universalPreviewIconSize: uiStore.universalPreviewIconSize,

    load,
    runStorageHealthCheck: eventsStore.runStorageHealthCheck,

    addEvent,
    updateEvent,

    deleteEvent: eventsStore.deleteEvent,

    addCalendar: eventsStore.addCalendar,
    updateCalendar: eventsStore.updateCalendar,
    deleteCalendar: eventsStore.deleteCalendar,
    toggleCalendarVisibility: eventsStore.toggleCalendarVisibility,

    setViewMode: settingsStore.setViewMode,
    setDayCount: settingsStore.setDayCount,
    setHourHeight: settingsStore.setHourHeight,
    setTimezone: settingsStore.setTimezone,
    toggle24Hour: settingsStore.toggle24Hour,
    setDayStartTime: settingsStore.setDayStartTime,

    setSelectedDate: uiStore.setSelectedDate,
    toggleSidebar: uiStore.toggleSidebar,
    toggleContextPanel: uiStore.toggleContextPanel,
    setEditingEventId: uiStore.setEditingEventId,
    setSelectedEventId: uiStore.setSelectedEventId,
    closeEditingEvent: uiStore.closeEditingEvent,

    toggleComplete: eventsStore.toggleComplete,
    updateEventColor: (uid: string, color: ItemColor) => eventsStore.updateEvent(uid, { color }),
    updateEventIcon: (uid: string, icon: string | undefined) => eventsStore.updateEvent(uid, { icon }),

    startTimer: eventsStore.startTimer,
    pauseTimer: eventsStore.pauseTimer,
    resumeTimer: eventsStore.resumeTimer,
    stopTimer: eventsStore.stopTimer,
  };
}
