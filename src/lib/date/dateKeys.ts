// Date key generation utilities

import { MS_PER_WEEK } from '../time/constants';

export function formatDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function getTodayKey(): string {
  return formatDateKey(new Date());
}

export function getYesterdayKey(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return formatDateKey(yesterday);
}

// Returns ISO week key (YYYY-Wxx), Monday as first day
export function getCurrentWeekKey(): string {
  const today = new Date();
  const firstDay = new Date(today);
  const day = today.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  firstDay.setDate(today.getDate() + diff);
  const yearStart = new Date(firstDay.getFullYear(), 0, 1);
  const weekNum = Math.ceil((firstDay.getTime() - yearStart.getTime()) / MS_PER_WEEK) + 1;
  return `${firstDay.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

export function getCurrentMonthKey(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
}
