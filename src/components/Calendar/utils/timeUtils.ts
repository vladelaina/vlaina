import { DEFAULT_DAY_START_TIME } from '@/lib/config';
import { MINUTES_PER_DAY } from '@/lib/time/constants';

export const DEFAULT_DAY_START_MINUTES = DEFAULT_DAY_START_TIME;

export function minutesToDisplayPosition(actualMinutes: number, dayStartMinutes: number = DEFAULT_DAY_START_MINUTES): number {
  let normalized = actualMinutes % MINUTES_PER_DAY;
  if (normalized < 0) normalized += MINUTES_PER_DAY;
  
  if (normalized >= dayStartMinutes) {
    return normalized - dayStartMinutes;
  }
  return normalized + (MINUTES_PER_DAY - dayStartMinutes);
}

export function displayPositionToMinutes(displayMinutes: number, dayStartMinutes: number = DEFAULT_DAY_START_MINUTES): number {
  const actualMinutes = displayMinutes + dayStartMinutes;
  if (actualMinutes >= MINUTES_PER_DAY) {
    return actualMinutes - MINUTES_PER_DAY;
  }
  if (actualMinutes < 0) {
    return actualMinutes + MINUTES_PER_DAY;
  }
  return actualMinutes;
}

export function hourToDisplayPosition(hour: number, dayStartMinutes: number = DEFAULT_DAY_START_MINUTES): number {
  let normalizedHour = hour % 24;
  if (normalizedHour < 0) normalizedHour += 24;
  
  const dayStartHour = Math.floor(dayStartMinutes / 60);
  if (normalizedHour >= dayStartHour) {
    return normalizedHour - dayStartHour;
  }
  return normalizedHour + (24 - dayStartHour);
}

export function displayPositionToHour(position: number, dayStartMinutes: number = DEFAULT_DAY_START_MINUTES): number {
  let normalizedPosition = position % 24;
  if (normalizedPosition < 0) normalizedPosition += 24;
  
  const dayStartHour = Math.floor(dayStartMinutes / 60);
  const hour = normalizedPosition + dayStartHour;
  return hour >= 24 ? hour - 24 : hour;
}

export function getSnapMinutes(hourHeight: number): number {
  if (hourHeight >= 400) return 1;
  if (hourHeight >= 256) return 5;
  if (hourHeight >= 128) return 10;
  if (hourHeight >= 64) return 15;
  return 30;
}

export function pixelsToMinutes(pixels: number, hourHeight: number, dayStartMinutes: number = DEFAULT_DAY_START_MINUTES): number {
  const displayMinutes = (pixels / hourHeight) * 60;
  const clampedDisplayMinutes = Math.max(0, Math.min(1439, displayMinutes));
  const actualMinutes = displayPositionToMinutes(clampedDisplayMinutes, dayStartMinutes);
  return Math.max(0, Math.min(1439, actualMinutes));
}

export function pixelsDeltaToMinutes(pixelsDelta: number, hourHeight: number): number {
  return (pixelsDelta / hourHeight) * 60;
}

export function minutesToPixels(minutes: number, hourHeight: number, dayStartMinutes: number = DEFAULT_DAY_START_MINUTES): number {
  const displayMinutes = minutesToDisplayPosition(minutes, dayStartMinutes);
  return (displayMinutes / 60) * hourHeight;
}

export function snapMinutes(minutes: number, snapInterval: number): number {
  if (snapInterval <= 0) return minutes;
  return Math.round(minutes / snapInterval) * snapInterval;
}

export function getMinutesFromMidnight(timestamp: number): number {
  const date = new Date(timestamp);
  return date.getHours() * 60 + date.getMinutes();
}

export function calculateEventTop(startDate: number, hourHeight: number, dayStartMinutes: number = DEFAULT_DAY_START_MINUTES): number {
  const date = new Date(startDate);
  const actualMinutes = date.getHours() * 60 + date.getMinutes();
  return minutesToPixels(actualMinutes, hourHeight, dayStartMinutes);
}

export function calculateEventHeight(startDate: number, endDate: number, hourHeight: number): number {
  const durationMs = endDate - startDate;
  const durationMinutes = Math.max(0, durationMs) / (1000 * 60);
  return (durationMinutes / 60) * hourHeight;
}

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

export function isEventInVisualDay(
  eventStartDate: number,
  visualDay: Date,
  dayStartMinutes: number = DEFAULT_DAY_START_MINUTES
): boolean {
  const eventDate = new Date(eventStartDate);
  
  const visualDayStart = new Date(visualDay);
  visualDayStart.setHours(Math.floor(dayStartMinutes / 60), dayStartMinutes % 60, 0, 0);
  
  const visualDayEnd = new Date(visualDayStart);
  visualDayEnd.setDate(visualDayEnd.getDate() + 1);
  
  const eventTime = eventDate.getTime();
  
  return eventTime >= visualDayStart.getTime() && eventTime < visualDayEnd.getTime();
}

export function getVisualDayBoundaries(
  eventTimestamp: number,
  dayStartMinutes: number = DEFAULT_DAY_START_MINUTES
): { start: number; end: number } {
  const eventDate = new Date(eventTimestamp);
  const eventHour = eventDate.getHours();
  const eventMinute = eventDate.getMinutes();
  const eventTotalMinutes = eventHour * 60 + eventMinute;
  
  const visualDayStart = new Date(eventDate);
  
  if (eventTotalMinutes < dayStartMinutes) {
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
