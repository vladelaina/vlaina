import type { ItemColor } from '@/lib/colors';

export interface NekoEvent {
    uid: string;
    summary: string;
    dtstart: Date;
    dtend: Date;
    scheduled?: boolean;
    allDay: boolean;
    description?: string;
    location?: string;
    calendarId: string;
    color?: ItemColor;
    icon?: string;
    iconSize?: number;
    timerState?: 'idle' | 'running' | 'paused';
    timerStartedAt?: number;
    timerAccumulated?: number;
    completed?: boolean;
    originalDtStart?: number;
    originalDtEnd?: number;
    groupId?: string;
    order?: number;
    parentId?: string;
    collapsed?: boolean;
    estimatedMinutes?: number;
}

export interface NekoCalendar {
    id: string;
    name: string;
    color: ItemColor;
    visible: boolean;
}

export const NEKO_X_PROPS = {
    COLOR: 'X-NEKO-COLOR',
    ICON: 'X-NEKO-ICON',
    ICON_SIZE: 'X-NEKO-ICON-SIZE',
    CALENDAR_ID: 'X-NEKO-CALENDAR-ID',
    TIMER_STATE: 'X-NEKO-TIMER-STATE',
    TIMER_STARTED: 'X-NEKO-TIMER-STARTED',
    TIMER_ACCUMULATED: 'X-NEKO-TIMER-ACCUMULATED',
    COMPLETED: 'X-NEKO-COMPLETED',
    ORIGINAL_DTSTART: 'X-NEKO-ORIGINAL-DTSTART',
    ORIGINAL_DTEND: 'X-NEKO-ORIGINAL-DTEND',
    GROUP_ID: 'X-NEKO-GROUP-ID',
    ORDER: 'X-NEKO-ORDER',
    PARENT_ID: 'X-NEKO-PARENT-ID',
    COLLAPSED: 'X-NEKO-COLLAPSED',
    ESTIMATED_MINUTES: 'X-NEKO-ESTIMATED-MINUTES',
    SCHEDULED: 'X-NEKO-SCHEDULED',
} as const;

