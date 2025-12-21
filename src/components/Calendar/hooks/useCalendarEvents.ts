import { useMemo } from 'react';
import { useUnifiedStore } from '@/stores/useUnifiedStore';
import { useUIStore } from '@/stores/uiSlice';
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
 * Also applies color filter from UI state
 * 
 * Exception: Currently editing event is always visible regardless of color filter
 * Exception: Task being dragged to calendar is hidden to avoid duplicate display
 */
export function useCalendarEvents(): CalendarDisplayItem[] {
  const tasks = useUnifiedStore(state => state.data.tasks);
  const editingEventId = useUnifiedStore(state => state.editingEventId);
  const selectedColors = useUIStore(state => state.selectedColors);
  const draggingToCalendarTaskId = useUIStore(state => state.draggingToCalendarTaskId);

  const displayItems = useMemo(() => {
    return tasks
      .filter(t => t.startDate !== undefined)
      // 隐藏正在拖动到日历的任务（避免重复显示）
      .filter(t => t.id !== draggingToCalendarTaskId)
      .filter(t => 
        // Always show the event being edited, regardless of color filter
        t.id === editingEventId || 
        selectedColors.includes(t.color || 'default')
      )
      .map(t => ({
        id: t.id,
        content: t.content,
        startDate: t.startDate!,
        endDate: t.endDate || t.startDate! + (t.estimatedMinutes || 60) * 60 * 1000,
        isAllDay: t.isAllDay || false,
        color: t.color || 'default',
        completed: t.completed,
        groupId: t.groupId,
      }));
  }, [tasks, selectedColors, editingEventId, draggingToCalendarTaskId]);

  return displayItems;
}
