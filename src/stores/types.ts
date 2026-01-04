// Store Types - Unified type definitions

import type { 
  UnifiedTask, 
  UnifiedGroup,
  UnifiedProgress,
  UnifiedArchiveSection,
  UnifiedArchiveEntry,
} from '@/lib/storage/unifiedStorage';

import type { ItemColor } from '@/lib/colors';

import type { TimeView } from '@/lib/date';

import type { TaskStatus } from './uiSlice';

import type { CalendarDisplayItem, CalendarEvent } from '@/lib/calendar';

// Core types re-export
export type { 
  UnifiedTask, 
  UnifiedGroup,
  UnifiedProgress,
  UnifiedArchiveSection,
  UnifiedArchiveEntry,
};

export type { ItemColor };
export type { TimeView };
export type { TaskStatus };

export type { CalendarDisplayItem, CalendarEvent };

// Derived type aliases (for backward compatibility)
export type StoreTask = UnifiedTask;
export type Task = UnifiedTask;
export type Group = UnifiedGroup;

// Undo system types
export type UndoAction = {
  type: 'deleteTask';
  task: UnifiedTask;
};
