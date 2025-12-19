import { useMemo } from 'react';
import { useUnifiedStore } from '@/stores/useUnifiedStore';
import type { ItemColor } from '@/stores/useUnifiedStore';

/**
 * Calendar event display item
 * 
 * Uses same field names as UnifiedTask for consistency
 */
export interface CalendarDisplayItem {
  id: string;
  content: string;
  startDate: number;
  endDate: number;
  isAllDay: boolean;
  color: ItemColor;
  completed: boolean;
  groupId: string;
}

/**
 * Calendar events hook under unified item model
 * 
 * Filters tasks with startDate for calendar display
 */
export function useCalendarEvents(): CalendarDisplayItem[] {
  const tasks = useUnifiedStore(state => state.data.tasks);

  const displayItems = useMemo(() => {
    return tasks
      .filter(t => t.startDate !== undefined)
      .map(t => ({
        id: t.id,
        content: t.content,
        startDate: t.startDate!,
        endDate: t.endDate || t.startDate! + (t.estimatedMinutes || 60) * 60 * 1000,
        isAllDay: t.isAllDay || false,
        color: t.color || 'blue',
        completed: t.completed,
        groupId: t.groupId,
      }));
  }, [tasks]);

  return displayItems;
}
