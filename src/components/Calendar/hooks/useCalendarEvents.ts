import { useMemo } from 'react';
import { useUnifiedStore } from '@/stores/useUnifiedStore';
import { useUIStore } from '@/stores/uiSlice';
import { toCalendarDisplayItem, type CalendarDisplayItem } from '@/lib/calendar';

export type { CalendarDisplayItem };

/**
 * Calendar events hook under unified item model
 * 
 * Filters tasks with startDate for calendar display
 * Also applies color filter and status filter from UI state
 * 
 * Exception: Currently editing event is always visible regardless of filters
 * Exception: Task being dragged to calendar is hidden to avoid duplicate display
 */
export function useCalendarEvents(): CalendarDisplayItem[] {
  const tasks = useUnifiedStore(state => state.data.tasks);
  const editingEventId = useUIStore(state => state.editingEventId);
  const selectedColors = useUIStore(state => state.selectedColors);
  const selectedStatuses = useUIStore(state => state.selectedStatuses);
  const draggingToCalendarTaskId = useUIStore(state => state.draggingToCalendarTaskId);

  const displayItems = useMemo(() => {
    return tasks
      .filter(t => t.startDate !== undefined)
      .filter(t => t.id !== draggingToCalendarTaskId)
      .filter(t => {
        if (t.id === editingEventId) return true;
        
        if (!selectedColors.includes(t.color || 'default')) return false;
        
        if (t.completed) {
          return selectedStatuses.includes('completed');
        } else {
          return selectedStatuses.includes('scheduled');
        }
      })
      .map(toCalendarDisplayItem);
  }, [tasks, selectedColors, selectedStatuses, editingEventId, draggingToCalendarTaskId]);

  return displayItems;
}
