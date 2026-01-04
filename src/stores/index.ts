// Store Module Exports

// Main unified store
export { useUnifiedStore, useStore } from './useUnifiedStore';

// View-specific stores (wrappers around UnifiedStore)
export { useGroupStore, useUIStore } from './useGroupStore';
export { useCalendarStore } from './useCalendarStore';
export { useProgressStore } from './useProgressStore';

// UI stores
export { useToastStore } from './useToastStore';

// Types
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
