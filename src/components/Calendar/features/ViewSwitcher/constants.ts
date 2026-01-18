/**
 * Calendar View Switcher Constants
 * 
 * Shared configuration for view modes and day counts.
 */

import type { TimeView } from '@/stores/useCalendarStore';

// View mode labels for display
export const VIEW_MODE_LABELS: Record<TimeView, string> = {
    day: 'Day',
    week: 'Week',
    month: 'Month',
};

// Keyboard shortcuts display
export const VIEW_MODE_SHORTCUTS: Record<TimeView, string> = {
    day: '1 or D',
    week: '0 or W',
    month: 'M',
};

// View mode order for dropdown
export const VIEW_MODE_ORDER: TimeView[] = ['day', 'week', 'month'];

// Day count options for submenu (2-9)
export const DAY_COUNT_OPTIONS = [2, 3, 4, 5, 6, 7, 8, 9] as const;

// Maximum custom day count
export const MAX_CUSTOM_DAY_COUNT = 14;
