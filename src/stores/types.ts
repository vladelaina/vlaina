import type {
  UnifiedProgress,
} from '@/lib/storage/unifiedStorage';

import type { ItemColor } from '@/lib/colors';
import type { TimeView } from '@/lib/date';
import type { NekoEvent, NekoCalendar } from '@/lib/ics/types';

export type {
  UnifiedProgress,
};

export type { ItemColor };
export type { TimeView };

export type { NekoEvent, NekoEvent as CalendarEvent, NekoCalendar };

export type UndoAction = {
  type: 'deleteTask';
  task: NekoEvent;
};
