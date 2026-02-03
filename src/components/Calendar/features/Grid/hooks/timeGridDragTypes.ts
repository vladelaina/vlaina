import type { NekoEvent } from '@/lib/ics/types';

export interface DragPosition {
    dayIndex: number;
    minutes: number;
}

export interface EventDragState {
    eventId: string;
    edge: 'top' | 'bottom' | null;
    startY: number;
    startScrollTop: number;
    originalStart: number;
    originalEnd: number;
    originalIsAllDay: boolean;
}

export interface TimeIndicator {
    startMinutes: number;
    endMinutes: number;
}

export interface AutoScrollState {
    rafId: number | null;
    lastMouseX: number;
    lastMouseY: number;
    isScrolling: boolean;
}

export interface TimeGridDragConfig {
    days: Date[];
    displayItems: NekoEvent[];
    columnCount: number;
    hourHeight: number;
    dayStartMinutes: number;
    snapMinutes: number;
    scrollRef: React.RefObject<HTMLDivElement | null>;
    canvasRef: React.RefObject<HTMLDivElement | null>;
    allDayAreaRef: React.RefObject<HTMLDivElement | null>;
}

export const createAutoScrollState = (): AutoScrollState => ({
    rafId: null,
    lastMouseX: 0,
    lastMouseY: 0,
    isScrolling: false,
});

export const stopAutoScroll = (state: AutoScrollState) => {
    if (state.rafId !== null) {
        cancelAnimationFrame(state.rafId);
        state.rafId = null;
    }
    state.isScrolling = false;
};