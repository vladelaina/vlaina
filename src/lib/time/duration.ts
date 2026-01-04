// Duration parsing and formatting module

import { MINUTES_PER_DAY, MINUTES_PER_HOUR } from './constants';

export interface DurationFormatOptions {
  showDays?: boolean;
  showSeconds?: boolean;
}

export interface ExtractDurationResult {
  cleanContent: string;
  minutes?: number;
}

const MAX_MINUTES = 144000;

export function parseDuration(input: string): number | undefined {
  if (!input || typeof input !== 'string') {
    return undefined;
  }

  const str = input.trim().toLowerCase();
  if (!str) {
    return undefined;
  }

  const pattern = /^(?:(\d+(?:\.\d+)?)d)?(?:(\d+(?:\.\d+)?)h)?(?:(\d+(?:\.\d+)?)m)?(?:(\d+(?:\.\d+)?)s)?$/i;
  const match = str.match(pattern);

  if (!match || !match[0].trim()) {
    return undefined;
  }

  const days = match[1] ? parseFloat(match[1]) : 0;
  const hours = match[2] ? parseFloat(match[2]) : 0;
  const minutes = match[3] ? parseFloat(match[3]) : 0;
  const seconds = match[4] ? parseFloat(match[4]) : 0;

  if (!isFinite(days) || !isFinite(hours) || !isFinite(minutes) || !isFinite(seconds) ||
      days < 0 || hours < 0 || minutes < 0 || seconds < 0) {
    return undefined;
  }

  const totalMinutes = days * MINUTES_PER_DAY + hours * MINUTES_PER_HOUR + minutes + seconds / 60;

  if (totalMinutes <= 0 || totalMinutes >= MAX_MINUTES) {
    return undefined;
  }

  return totalMinutes;
}

export function formatDuration(minutes: number, options: DurationFormatOptions = {}): string {
  if (!isFinite(minutes) || minutes < 0) {
    return '0m';
  }

  const { showDays = false, showSeconds = false } = options;

  const cappedMinutes = Math.min(minutes, MAX_MINUTES);

  const totalSeconds = Math.round(cappedMinutes * 60);

  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  const parts: string[] = [];

  if (showDays && days > 0) {
    parts.push(`${days}d`);
  } else if (!showDays && days > 0) {
    const totalHours = days * 24 + hours;
    if (totalHours > 0) parts.push(`${totalHours}h`);
    if (mins > 0) parts.push(`${mins}m`);
    if (showSeconds && secs > 0) parts.push(`${secs}s`);
    return parts.length === 0 ? '0m' : parts.join('');
  }

  if (hours > 0) parts.push(`${hours}h`);
  if (mins > 0) parts.push(`${mins}m`);
  if (showSeconds && secs > 0) parts.push(`${secs}s`);

  return parts.length === 0 ? '0m' : parts.join('');
}

export function formatDurationFull(minutes: number): string {
  if (!isFinite(minutes) || minutes < 0) {
    return '0s';
  }

  const cappedMinutes = Math.min(minutes, MAX_MINUTES);
  const totalSeconds = Math.round(cappedMinutes * 60);

  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (mins > 0) parts.push(`${mins}m`);
  if (secs > 0) parts.push(`${secs}s`);

  return parts.length === 0 ? '0s' : parts.join('');
}

export function extractDuration(content: string): ExtractDurationResult {
  if (!content || typeof content !== 'string') {
    return { cleanContent: content || '' };
  }

  const pattern = /\s+(?:(\d+(?:\.\d+)?)d)?(?:(\d+(?:\.\d+)?)h)?(?:(\d+(?:\.\d+)?)m)?(?:(\d+(?:\.\d+)?)s)?$/i;
  const match = content.match(pattern);

  if (match && match[0].trim()) {
    const timeStr = match[0].trim();
    const minutes = parseDuration(timeStr);

    if (minutes !== undefined) {
      const cleanContent = content.replace(match[0], '').trim();
      
      if (cleanContent.length === 0) {
        return { cleanContent: content };
      }
      
      return { cleanContent, minutes };
    }
  }

  return { cleanContent: content };
}


