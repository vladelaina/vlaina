/**
 * Calendar Time Utilities
 * 
 * Centralized management of all time-related calculations
 * Supports configurable day start time
 */

import { DEFAULT_DAY_START_TIME } from '@/lib/config';
import { MINUTES_PER_DAY } from '@/lib/time/constants';

// Re-export for backward compatibility
export const DEFAULT_DAY_START_MINUTES = DEFAULT_DAY_START_TIME;

/**
 * Convert actual minutes (0-1439) to display position minutes (0-1439)
 * Maps minutes so that dayStartMinutes appears at position 0
 */
export function minutesToDisplayPosition(actualMinutes: number, dayStartMinutes: number = DEFAULT_DAY_START_MINUTES): number {
  // Normalize actualMinutes to 0-1439 range first
  let normalized = actualMinutes % MINUTES_PER_DAY;
  if (normalized < 0) normalized += MINUTES_PER_DAY;
  
  if (normalized >= dayStartMinutes) {
    return normalized - dayStartMinutes;
  }
  return normalized + (MINUTES_PER_DAY - dayStartMinutes);
}

/**
 * Convert display position minutes (0-1439) to actual minutes (0-1439)
 */
export function displayPositionToMinutes(displayMinutes: number, dayStartMinutes: number = DEFAULT_DAY_START_MINUTES): number {
  const actualMinutes = displayMinutes + dayStartMinutes;
  // Handle wrap-around and ensure result is within 0-1439
  if (actualMinutes >= MINUTES_PER_DAY) {
    return actualMinutes - MINUTES_PER_DAY;
  }
  if (actualMinutes < 0) {
    return actualMinutes + MINUTES_PER_DAY;
  }
  return actualMinutes;
}

/**
 * Convert actual hour (0-23) to display position (0-23)
 * Maps hours so that day start hour appears at position 0
 */
export function hourToDisplayPosition(hour: number, dayStartMinutes: number = DEFAULT_DAY_START_MINUTES): number {
  // Normalize hour to 0-23 range
  let normalizedHour = hour % 24;
  if (normalizedHour < 0) normalizedHour += 24;
  
  const dayStartHour = Math.floor(dayStartMinutes / 60);
  if (normalizedHour >= dayStartHour) {
    return normalizedHour - dayStartHour;
  }
  return normalizedHour + (24 - dayStartHour);
}

/**
 * Convert display position (0-23) to actual hour (0-23)
 */
export function displayPositionToHour(position: number, dayStartMinutes: number = DEFAULT_DAY_START_MINUTES): number {
  // Normalize position to 0-23 range
  let normalizedPosition = position % 24;
  if (normalizedPosition < 0) normalizedPosition += 24;
  
  const dayStartHour = Math.floor(dayStartMinutes / 60);
  const hour = normalizedPosition + dayStartHour;
  return hour >= 24 ? hour - 24 : hour;
}

/**
 * Dynamically calculate time precision (minutes) based on zoom level
 */
export function getSnapMinutes(hourHeight: number): number {
  if (hourHeight >= 400) return 1;
  if (hourHeight >= 256) return 5;
  if (hourHeight >= 128) return 10;
  if (hourHeight >= 64) return 15;
  return 30;
}

/**
 * Convert pixel position to minutes (adjusted for day start time)
 * Returns actual time minutes (0-1439) where 0 = midnight
 */
export function pixelsToMinutes(pixels: number, hourHeight: number, dayStartMinutes: number = DEFAULT_DAY_START_MINUTES): number {
  const displayMinutes = (pixels / hourHeight) * 60;
  // Clamp display minutes to valid range (0-1439) before conversion
  const clampedDisplayMinutes = Math.max(0, Math.min(1439, displayMinutes));
  const actualMinutes = displayPositionToMinutes(clampedDisplayMinutes, dayStartMinutes);
  // Ensure result is also within valid range
  return Math.max(0, Math.min(1439, actualMinutes));
}

/**
 * Convert pixel delta to minutes delta (for relative movement calculations)
 * This does NOT apply day start offset - used for drag deltas
 */
export function pixelsDeltaToMinutes(pixelsDelta: number, hourHeight: number): number {
  return (pixelsDelta / hourHeight) * 60;
}

/**
 * Convert minutes to pixel position (adjusted for day start time)
 */
export function minutesToPixels(minutes: number, hourHeight: number, dayStartMinutes: number = DEFAULT_DAY_START_MINUTES): number {
  const displayMinutes = minutesToDisplayPosition(minutes, dayStartMinutes);
  return (displayMinutes / 60) * hourHeight;
}

/**
 * Snap minutes to interval
 */
export function snapMinutes(minutes: number, snapInterval: number): number {
  if (snapInterval <= 0) return minutes; // Prevent division by zero
  return Math.round(minutes / snapInterval) * snapInterval;
}

/**
 * Get minutes offset from midnight for a timestamp
 */
export function getMinutesFromMidnight(timestamp: number): number {
  const date = new Date(timestamp);
  return date.getHours() * 60 + date.getMinutes();
}

/**
 * Calculate event's vertical position in the grid (adjusted for day start time)
 */
export function calculateEventTop(startDate: number, hourHeight: number, dayStartMinutes: number = DEFAULT_DAY_START_MINUTES): number {
  const date = new Date(startDate);
  const actualMinutes = date.getHours() * 60 + date.getMinutes();
  return minutesToPixels(actualMinutes, hourHeight, dayStartMinutes);
}

/**
 * Calculate event's height in the grid
 */
export function calculateEventHeight(startDate: number, endDate: number, hourHeight: number): number {
  const durationMs = endDate - startDate;
  // Ensure non-negative duration
  const durationMinutes = Math.max(0, durationMs) / (1000 * 60);
  return (durationMinutes / 60) * hourHeight;
}

/**
 * Constants configuration
 */
export const CALENDAR_CONSTANTS = {
  GUTTER_WIDTH: 60,
  GAP: 3,
  RESIZE_HANDLE_HEIGHT: 6,
  AUTO_SCROLL_THRESHOLD: 5,
  AUTO_SCROLL_SPEED: 10,
  MIN_HOUR_HEIGHT: 32,
  MAX_HOUR_HEIGHT: 800,
  ZOOM_FACTOR: 1.15,
  MIN_EVENT_DURATION_MINUTES: 5,
} as const;

/**
 * Check if an event belongs to a "visual day" based on dayStartMinutes
 * 
 * A visual day runs from dayStartMinutes on one calendar day to dayStartMinutes on the next.
 * For example, if dayStartMinutes is 300 (5:00 AM):
 * - Visual day for Monday runs from Monday 5:00 AM to Tuesday 5:00 AM
 * - An event at Monday 11:00 PM belongs to Monday's visual day
 * - An event at Tuesday 2:00 AM also belongs to Monday's visual day
 * 
 * @param eventStartDate - The event's start timestamp
 * @param visualDay - The calendar date representing the visual day
 * @param dayStartMinutes - Minutes from midnight when the visual day starts
 */
export function isEventInVisualDay(
  eventStartDate: number,
  visualDay: Date,
  dayStartMinutes: number = DEFAULT_DAY_START_MINUTES
): boolean {
  const eventDate = new Date(eventStartDate);
  
  // Calculate the visual day's start and end timestamps
  const visualDayStart = new Date(visualDay);
  visualDayStart.setHours(Math.floor(dayStartMinutes / 60), dayStartMinutes % 60, 0, 0);
  
  const visualDayEnd = new Date(visualDayStart);
  visualDayEnd.setDate(visualDayEnd.getDate() + 1);
  
  const eventTime = eventDate.getTime();
  
  return eventTime >= visualDayStart.getTime() && eventTime < visualDayEnd.getTime();
}

/**
 * Get the visual day boundaries for a given event timestamp
 * Returns the start and end timestamps of the visual day the event belongs to
 */
export function getVisualDayBoundaries(
  eventTimestamp: number,
  dayStartMinutes: number = DEFAULT_DAY_START_MINUTES
): { start: number; end: number } {
  const eventDate = new Date(eventTimestamp);
  const eventHour = eventDate.getHours();
  const eventMinute = eventDate.getMinutes();
  const eventTotalMinutes = eventHour * 60 + eventMinute;
  
  // Determine which visual day this event belongs to
  const visualDayStart = new Date(eventDate);
  
  if (eventTotalMinutes < dayStartMinutes) {
    // Event is in the "late night" portion (before dayStartMinutes)
    // It belongs to the previous calendar day's visual day
    visualDayStart.setDate(visualDayStart.getDate() - 1);
  }
  
  visualDayStart.setHours(Math.floor(dayStartMinutes / 60), dayStartMinutes % 60, 0, 0);
  
  const visualDayEnd = new Date(visualDayStart);
  visualDayEnd.setDate(visualDayEnd.getDate() + 1);
  
  return {
    start: visualDayStart.getTime(),
    end: visualDayEnd.getTime(),
  };
}
