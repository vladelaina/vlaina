/**
 * Store Module Exports
 * 
 * Main entry point for all stores.
 * useUnifiedStore is the source of truth for all data.
 */

// Main unified store
export { useUnifiedStore, useStore } from './useUnifiedStore';

// View-specific stores (wrappers around UnifiedStore)
export { useGroupStore, useUIStore } from './useGroupStore';
export { useCalendarStore } from './useCalendarStore';
export { useProgressStore } from './useProgressStore';

// UI stores
export { useToastStore } from './useToastStore';

// Types - 统一从 types.ts 导出
export type { 
  UnifiedTask,
  Group, 
  StoreTask, 
  Task,
  CalendarEvent,
  CalendarDisplayItem,
  ItemColor,
  TimeView,
  TaskStatus,
} from './types';

// Utilities - Time (from unified time module)
export { parseDuration, extractDuration } from '@/lib/time';
export { collectTaskAndDescendants, calculateActualTime } from './taskUtils';
export { reorderTasksInGroup, crossStatusReorderTask, moveTaskBetweenGroups } from './reorderUtils';
