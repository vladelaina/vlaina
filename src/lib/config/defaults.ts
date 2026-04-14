import { detectSystemTimezone } from './detectTimezone';

export const DEFAULT_TIMEZONE = detectSystemTimezone();
export const STORAGE_KEY_SHORTCUTS = 'vlaina-shortcuts';
export const STORAGE_KEY_PENDING_SYNC = 'pendingSync';
export const STORAGE_KEY_FONT_SIZE = 'fontSize';
export const STORAGE_KEY_AUTO_UPDATE = 'autoUpdate';
export const STORAGE_KEY_NOTES_SIDEBAR_COLLAPSED = 'vlaina-notes-sidebar-collapsed';
export const STORAGE_KEY_SHOW_SIDEBAR = 'vlaina-show-sidebar';

export const DEFAULT_SETTINGS = {
  timezone: {
    offset: DEFAULT_TIMEZONE,
    city: 'Beijing',
  },
  markdown: {
    codeBlock: {
      showLineNumbers: true,
    },
  },
} as const;
