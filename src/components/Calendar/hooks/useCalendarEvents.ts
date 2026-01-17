import { useMemo } from 'react';
import { useCalendarStore } from '@/stores/useCalendarStore';
import { useUIStore } from '@/stores/uiSlice';
import type { NekoEvent } from '@/lib/ics/types';



/**
 * Calendar events hook
 * 
 * Retrieves events from calendar store and applies UI filters (color, status)
 */
export function useCalendarEvents(): NekoEvent[] {
  const { events, allEvents } = useCalendarStore();
  const editingEventId = useUIStore(state => state.editingEventId);
  const selectedColors = useUIStore(state => state.selectedColors);
  const selectedStatuses = useUIStore(state => state.selectedStatuses);

  // Debug: Log when editingEventId changes
  if (editingEventId) {
    console.log('[useCalendarEvents] EditingEventId:', editingEventId);
    console.log('[useCalendarEvents] events count:', events.length);
    console.log('[useCalendarEvents] allEvents count:', allEvents.length);
    console.log('[useCalendarEvents] Event in events?', events.some(e => e.uid === editingEventId));
    console.log('[useCalendarEvents] Event in allEvents?', allEvents.some(e => e.uid === editingEventId));
  }

  // Note: 'draggingToCalendarTaskId' is less relevant now as tasks and events are separate,
  // but we might need a distinct state for dragging calendar events if needed.

  const displayItems = useMemo(() => {
    const filtered = events.filter(e => {
      // Always show the event being edited
      if (e.uid === editingEventId) return true;

      // Color filter
      if (!selectedColors.includes(e.color || 'default')) return false;

      // Status filter
      if (e.completed) {
        return selectedStatuses.includes('completed');
      } else {
        return selectedStatuses.includes('scheduled'); // All non-completed calendar events are "scheduled"
      }
    });

    // If editing event is not in filtered list, try to get it directly from store
    // This handles the case where the event's calendar is not visible
    if (editingEventId && !filtered.find(e => e.uid === editingEventId)) {
      console.log('[useCalendarEvents] Editing event not in filtered, checking allEvents...');
      const editingEvent = allEvents.find(e => e.uid === editingEventId);
      if (editingEvent) {
        console.log('[useCalendarEvents] Found in allEvents, adding to result');
        return [editingEvent, ...filtered];
      } else {
        console.log('[useCalendarEvents] NOT FOUND in allEvents either!');
      }
    }

    return filtered;
  }, [events, allEvents, selectedColors, selectedStatuses, editingEventId]);

  return displayItems;
}
