/**
 * Calendar Module Constants
 * 
 * Centralized constants for the calendar module to ensure consistency
 * and easy maintenance across components.
 */

// -------------------------------------------------------------------------
// Grid Layout Constants
// -------------------------------------------------------------------------

export const CALENDAR_GRID = {
    /** Gap between elements in pixels */
    GAP: 2,
    /** Width of the time gutter in pixels */
    GUTTER_WIDTH: 48,
    /** Height of resize handles in pixels */
    RESIZE_HANDLE_HEIGHT: 8,
    /** Default hour height in pixels */
    DEFAULT_HOUR_HEIGHT: 52,
    /** Zoom sensitivity factor */
    ZOOM_FACTOR: 0.1,
} as const;

// -------------------------------------------------------------------------
// All-Day Area Constants
// -------------------------------------------------------------------------

export const ALL_DAY = {
    /** Maximum visible rows before showing "more" indicator */
    MAX_VISIBLE_ROWS: 3,
    /** Height of each all-day event in pixels */
    EVENT_HEIGHT: 22,
    /** Gap between all-day events in pixels */
    EVENT_GAP: 2,
    /** Minimum height of the all-day area in pixels */
    MIN_AREA_HEIGHT: 28,
    /** Height when collapsed with chevron */
    COLLAPSED_HEIGHT: 28,
} as const;

// -------------------------------------------------------------------------
// Time Configuration
// -------------------------------------------------------------------------

export const TIME = {
    /** Default day start time (5:00 AM) in minutes from midnight */
    DEFAULT_DAY_START_MINUTES: 5 * 60,
    /** Minutes in a day */
    MINUTES_PER_DAY: 24 * 60,
    /** Snap interval in minutes (depends on hour height) */
    getSnapMinutes: (hourHeight: number) => {
        if (hourHeight >= 100) return 5;
        if (hourHeight >= 60) return 15;
        return 30;
    },
} as const;

// -------------------------------------------------------------------------
// Auto-Scroll Configuration
// -------------------------------------------------------------------------

export const AUTO_SCROLL = {
    /** Distance from edge that triggers auto-scroll */
    EDGE_THRESHOLD: 80,
    /** Maximum scroll speed in pixels per frame */
    MAX_SCROLL_SPEED: 15,
} as const;

// -------------------------------------------------------------------------
// Custom Day Count
// -------------------------------------------------------------------------

export const DAY_COUNT = {
    /** Minimum allowed day count */
    MIN: 1,
    /** Maximum allowed day count */
    MAX: 14,
    /** Quick select options (2-9) */
    OPTIONS: [2, 3, 4, 5, 6, 7, 8, 9] as const,
} as const;
