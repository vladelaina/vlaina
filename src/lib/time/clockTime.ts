// Clock time parsing and formatting module

import { MINUTES_PER_DAY } from './constants';

export interface ClockTime {
  hours: number;
  minutes: number;
}

const PM_INDICATORS = ['pm', 'p.m.', 'p.m', '下午', '晚上'];
const AM_INDICATORS = ['am', 'a.m.', 'a.m', '上午', '早上', '凌晨'];

export function parseClockTime(input: string): ClockTime | null {
  if (!input || typeof input !== 'string') {
    return null;
  }

  let str = input.trim().toLowerCase();
  str = str.replace(/[：.。\-－]/g, ':');
  str = str.replace(/\s+/g, ' ');

  let isPM = false;
  let isAM = false;

  for (const indicator of PM_INDICATORS) {
    if (str.includes(indicator)) {
      isPM = true;
      str = str.replace(indicator, '').trim();
      break;
    }
  }

  if (!isPM) {
    for (const indicator of AM_INDICATORS) {
      if (str.includes(indicator)) {
        isAM = true;
        str = str.replace(indicator, '').trim();
        break;
      }
    }
  }

  str = str.replace(/点/g, ':');
  str = str.replace(/:+$/, '');

  let hours = 0;
  let minutes = 0;

  const colonMatch = str.match(/^(\d{1,2}):(\d{1,2})$/);
  if (colonMatch) {
    hours = parseInt(colonMatch[1], 10);
    minutes = parseInt(colonMatch[2], 10);
  } else {
    const numMatch = str.match(/^(\d{3,4})$/);
    if (numMatch) {
      const num = numMatch[1];
      if (num.length === 3) {
        hours = parseInt(num[0], 10);
        minutes = parseInt(num.slice(1), 10);
      } else {
        hours = parseInt(num.slice(0, 2), 10);
        minutes = parseInt(num.slice(2), 10);
      }
    } else {
      const hourOnlyMatch = str.match(/^(\d{1,2})$/);
      if (hourOnlyMatch) {
        hours = parseInt(hourOnlyMatch[1], 10);
        minutes = 0;
      } else {
        return null;
      }
    }
  }

  if (isPM && hours < 12) {
    hours += 12;
  } else if (isAM && hours === 12) {
    hours = 0;
  }

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  return { hours, minutes };
}

export function formatClockTime(totalMinutes: number, use24Hour: boolean = true): string {
  let normalized = totalMinutes % MINUTES_PER_DAY;
  if (normalized < 0) normalized += MINUTES_PER_DAY;

  const hours = Math.floor(normalized / 60) % 24;
  const minutes = Math.floor(normalized % 60);

  if (use24Hour) {
    return `${hours}:${minutes.toString().padStart(2, '0')}`;
  } else {
    const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    const ampm = hours < 12 ? 'AM' : 'PM';
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  }
}

export function clockTimeToMinutes(time: ClockTime): number {
  return time.hours * 60 + time.minutes;
}

export function minutesToClockTime(totalMinutes: number): ClockTime {
  let normalized = totalMinutes % MINUTES_PER_DAY;
  if (normalized < 0) normalized += MINUTES_PER_DAY;

  return {
    hours: Math.floor(normalized / 60) % 24,
    minutes: Math.floor(normalized % 60),
  };
}


