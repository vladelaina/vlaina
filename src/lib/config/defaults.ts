// Application Default Configuration

import type { TimeView } from '@/lib/date';

export const DEFAULT_TIMEZONE = 8;
export const DEFAULT_VIEW_MODE: TimeView = 'day';
export const DEFAULT_DAY_COUNT = 1;
export const DEFAULT_HOUR_HEIGHT = 64;
export const DEFAULT_USE_24_HOUR = false;
export const DEFAULT_DAY_START_TIME = 300;

export const DEFAULT_GROUP_ID = 'default';
export const DEFAULT_GROUP_NAME = 'Inbox';

export const STORAGE_KEY_COLOR_FILTER = 'nekotick-color-filter';
export const STORAGE_KEY_STATUS_FILTER = 'nekotick-status-filter';
export const STORAGE_KEY_SHORTCUTS = 'nekotick-shortcuts';
export const STORAGE_KEY_PENDING_SYNC = 'pendingSync';
export const STORAGE_KEY_FONT_SIZE = 'fontSize';
export const STORAGE_KEY_AUTO_UPDATE = 'autoUpdate';
export const STORAGE_KEY_NOTES_SIDEBAR_COLLAPSED = 'nekotick-notes-sidebar-collapsed';
export const STORAGE_KEY_SHOW_SIDEBAR = 'nekotick-show-sidebar';

export const DEFAULT_SETTINGS = {
  timezone: DEFAULT_TIMEZONE,
  viewMode: DEFAULT_VIEW_MODE,
  dayCount: DEFAULT_DAY_COUNT,
  hourHeight: DEFAULT_HOUR_HEIGHT,
  use24Hour: DEFAULT_USE_24_HOUR,
  dayStartTime: DEFAULT_DAY_START_TIME,
} as const;
