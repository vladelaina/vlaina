export const CALENDAR_GRID = {
    GAP: 2,
    GUTTER_WIDTH: 48,
    RESIZE_HANDLE_HEIGHT: 8,
    DEFAULT_HOUR_HEIGHT: 52,
    ZOOM_FACTOR: 0.1,
} as const;

export const ALL_DAY = {
    MAX_VISIBLE_ROWS: 3,
    EVENT_HEIGHT: 22,
    EVENT_GAP: 2,
    MIN_AREA_HEIGHT: 28,
    COLLAPSED_HEIGHT: 28,
} as const;

export const TIME = {
    DEFAULT_DAY_START_MINUTES: 5 * 60,
    MINUTES_PER_DAY: 24 * 60,
    getSnapMinutes: (hourHeight: number) => {
        if (hourHeight >= 100) return 5;
        if (hourHeight >= 60) return 15;
        return 30;
    },
} as const;

export const AUTO_SCROLL = {
    EDGE_THRESHOLD: 80,
    MAX_SCROLL_SPEED: 15,
} as const;

export const DAY_COUNT = {
    MIN: 1,
    MAX: 14,
    OPTIONS: [2, 3, 4, 5, 6, 7, 8, 9] as const,
} as const;
