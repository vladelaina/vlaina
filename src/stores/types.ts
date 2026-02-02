import type {
  UnifiedProgress,
  UnifiedArchiveSection,
  UnifiedArchiveEntry,
} from '@/lib/storage/unifiedStorage';

import type { ItemColor } from '@/lib/colors';
import type { TimeView } from '@/lib/date';
import type { TaskStatus } from './uiSlice';
import type { NekoEvent, NekoCalendar } from '@/lib/ics/types';

export type {
  UnifiedProgress,
  UnifiedArchiveSection,
  UnifiedArchiveEntry,
};

export type { ItemColor };
export type { TimeView };
export type { TaskStatus };

export type { NekoEvent, NekoEvent as CalendarEvent, NekoCalendar };

export type UndoAction = {
  type: 'deleteTask';
  task: NekoEvent;
};
