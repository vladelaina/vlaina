/**
 * useEventTimer - Event timer state management
 * 
 * Tracks elapsed time for events with running or paused timers.
 * Updates every 100ms when a timer is running.
 */

import { useState, useEffect, useMemo } from 'react';
import type { NekoEvent } from '@/lib/ics/types';

interface UseEventTimerProps {
    event: NekoEvent;
    plannedHeight: number;
    hourHeight: number;
}

interface UseEventTimerReturn {
    elapsedMs: number;
    isTimerActive: boolean;
    isTimerRunning: boolean;
    isTimerPaused: boolean;
    actualHeight: number;
}

export function useEventTimer({
    event,
    plannedHeight,
    hourHeight,
}: UseEventTimerProps): UseEventTimerReturn {
    const [elapsedMs, setElapsedMs] = useState(0);

    const isTimerRunning = event.timerState === 'running';
    const isTimerPaused = event.timerState === 'paused';
    const isTimerActive = isTimerRunning || isTimerPaused;

    useEffect(() => {
        if (!isTimerRunning && !isTimerPaused) {
            setElapsedMs(0);
            return;
        }

        if (isTimerPaused) {
            setElapsedMs(event.timerAccumulated || 0);
            return;
        }

        const updateElapsed = () => {
            const accumulated = event.timerAccumulated || 0;
            const startedAt = event.timerStartedAt || Date.now();
            const sinceStart = Date.now() - startedAt;
            setElapsedMs(accumulated + sinceStart);
        };

        updateElapsed();

        const interval = setInterval(updateElapsed, 100);
        return () => clearInterval(interval);
    }, [isTimerRunning, isTimerPaused, event.timerStartedAt, event.timerAccumulated]);

    const actualHeight = useMemo(() => {
        if (!isTimerActive) return plannedHeight;
        const elapsedHeight = (elapsedMs / 3600000) * hourHeight;
        return Math.max(plannedHeight, elapsedHeight);
    }, [isTimerActive, elapsedMs, plannedHeight, hourHeight]);

    return {
        elapsedMs,
        isTimerActive,
        isTimerRunning,
        isTimerPaused,
        actualHeight,
    };
}

/**
 * Format elapsed milliseconds to a display string
 */
export function formatElapsedTime(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    if (minutes >= 60) {
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        return `${hours}:${remainingMinutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Get height level classification for responsive styling
 */
export function getHeightLevel(height: number): 'micro' | 'tiny' | 'small' | 'medium' | 'large' {
    if (height < 20) return 'micro';
    if (height < 32) return 'tiny';
    if (height < 48) return 'small';
    if (height < 80) return 'medium';
    return 'large';
}
