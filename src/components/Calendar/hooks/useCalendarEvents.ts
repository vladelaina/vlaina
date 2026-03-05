import { useMemo } from 'react';
import { useCalendarStore } from '@/stores/useCalendarStore';
import { useUIStore } from '@/stores/uiSlice';
import type { NekoEvent } from '@/lib/ics/types';

export function useCalendarEvents(): NekoEvent[] {
  const { events, allEvents } = useCalendarStore();
  const editingEventId = useUIStore(state => state.editingEventId);
  const selectedColors = useUIStore(state => state.selectedColors);
  const selectedStatuses = useUIStore(state => state.selectedStatuses);

  const displayItems = useMemo(() => {
    const filtered = events.filter(e => {
      if (e.uid === editingEventId) return true;
      if (e.scheduled === false) return false;

      if (!selectedColors.includes(e.color || 'default')) return false;

      if (e.completed) {
        return selectedStatuses.includes('completed');
      } else {
        return selectedStatuses.includes('scheduled');
      }
    });

    if (editingEventId && !filtered.find(e => e.uid === editingEventId)) {
      const editingEvent = allEvents.find(e => e.uid === editingEventId);
      if (editingEvent) {
        return [editingEvent, ...filtered];
      }
    }

    return filtered;
  }, [events, allEvents, selectedColors, selectedStatuses, editingEventId]);

  return displayItems;
}
