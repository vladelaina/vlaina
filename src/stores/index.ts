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
export { useUndoStore } from './useUndoStore';

// Types
export type { Group, StoreTask, ItemColor } from './types';
export type { TimeView } from '@/lib/date';

// Utilities - Time (from unified time module)
export { parseDuration, extractDuration } from '@/lib/time';
export { collectTaskAndDescendants, calculateActualTime } from './taskUtils';
export { reorderTasksInGroup, crossStatusReorderTask, moveTaskBetweenGroups } from './reorderUtils';
