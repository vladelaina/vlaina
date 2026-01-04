// Calendar Transforms - Task to CalendarDisplayItem conversion

import type { UnifiedTask } from '@/lib/storage/unifiedStorage';
import type { ItemColor } from '@/lib/colors';
import { DEFAULT_COLOR } from '@/lib/colors';
import { DEFAULT_EVENT_DURATION_MS } from './constants';

export interface CalendarDisplayItem {
  id: string;
  content: string;
  startDate: number;
  endDate: number;
  isAllDay: boolean;
  color: ItemColor;
  completed: boolean;
  description?: string;
  location?: string;
  groupId: string;
  icon?: string;
  timerState?: 'idle' | 'running' | 'paused';
  timerStartedAt?: number;
  timerAccumulated?: number;
}

export type CalendarEvent = CalendarDisplayItem;

export function calculateEndDate(task: UnifiedTask): number {
  if (task.endDate !== undefined) {
    return task.endDate;
  }
  
  if (task.startDate === undefined) {
    return Date.now() + DEFAULT_EVENT_DURATION_MS;
  }
  
  if (task.estimatedMinutes !== undefined && task.estimatedMinutes > 0) {
    return task.startDate + task.estimatedMinutes * 60 * 1000;
  }
  
  return task.startDate + DEFAULT_EVENT_DURATION_MS;
}

export function toCalendarDisplayItem(task: UnifiedTask): CalendarDisplayItem {
  if (task.startDate === undefined) {
    throw new Error(`Task ${task.id} has no startDate, cannot convert to CalendarDisplayItem`);
  }
  
  return {
    id: task.id,
    content: task.content,
    startDate: task.startDate,
    endDate: calculateEndDate(task),
    isAllDay: task.isAllDay || false,
    color: task.color || DEFAULT_COLOR,
    completed: task.completed,
    description: task.description,
    location: task.location,
    groupId: task.groupId,
    icon: task.icon,
    timerState: task.timerState,
    timerStartedAt: task.timerStartedAt,
    timerAccumulated: task.timerAccumulated,
  };
}

export function toCalendarDisplayItems(tasks: UnifiedTask[]): CalendarDisplayItem[] {
  return tasks
    .filter(t => t.startDate !== undefined)
    .map(toCalendarDisplayItem);
}

