import type { NekoEvent } from '@/lib/ics/types';
import { formatDateKey, getTodayKey } from '@/lib/date';

export const SYSTEM_TAG_PREFIX = '__system__:';
export const SYSTEM_TAG_TODAY = `${SYSTEM_TAG_PREFIX}today`;
export const SYSTEM_TAG_WEEK = `${SYSTEM_TAG_PREFIX}week`;

function toTagKey(tag: string): string {
  return normalizeTag(tag).toLocaleLowerCase();
}

export function normalizeTag(tag: string): string {
  return tag.replace(/\s+/g, ' ').trim();
}

export function normalizeTags(tags?: string[] | null): string[] {
  if (!tags || tags.length === 0) return [];

  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const raw of tags) {
    const tag = normalizeTag(raw);
    if (!tag) continue;
    const key = toTagKey(tag);
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(tag);
  }

  return normalized;
}

export function serializeTags(tags?: string[] | null): string | undefined {
  const normalized = normalizeTags(tags);
  if (normalized.length === 0) return undefined;
  return encodeURIComponent(JSON.stringify(normalized));
}

export function deserializeTags(serialized?: string | null): string[] | undefined {
  if (!serialized) return undefined;

  try {
    const decoded = decodeURIComponent(serialized);
    const parsed = JSON.parse(decoded);
    if (Array.isArray(parsed)) {
      const normalized = normalizeTags(parsed.filter((item): item is string => typeof item === 'string'));
      return normalized.length > 0 ? normalized : undefined;
    }
  } catch {
    const fallback = normalizeTags(serialized.split(','));
    if (fallback.length > 0) return fallback;
  }

  return undefined;
}

export function taskHasTag(task: NekoEvent, tag: string): boolean {
  const targetKey = toTagKey(tag);
  if (!targetKey) return false;

  const tags = normalizeTags(task.tags);
  return tags.some(item => toTagKey(item) === targetKey);
}

export function isSystemTagFilter(tag: string | null): boolean {
  return !!tag && tag.startsWith(SYSTEM_TAG_PREFIX);
}

export function isTodaySystemTag(tag: string | null): boolean {
  return tag === SYSTEM_TAG_TODAY;
}

export function isWeekSystemTag(tag: string | null): boolean {
  return tag === SYSTEM_TAG_WEEK;
}

function isInCurrentWeek(date: Date): boolean {
  const now = new Date();
  const weekStart = new Date(now);
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  weekStart.setDate(now.getDate() + diff);
  weekStart.setHours(0, 0, 0, 0);

  const nextWeekStart = new Date(weekStart);
  nextWeekStart.setDate(weekStart.getDate() + 7);

  return date >= weekStart && date < nextWeekStart;
}

export function matchesSelectedTag(task: NekoEvent, selectedTag: string | null): boolean {
  if (!selectedTag) return true;
  if (isTodaySystemTag(selectedTag)) {
    if (!task.dtstart) return false;
    return formatDateKey(new Date(task.dtstart)) === getTodayKey();
  }
  if (isWeekSystemTag(selectedTag)) {
    if (!task.dtstart) return false;
    return isInCurrentWeek(new Date(task.dtstart));
  }
  return taskHasTag(task, selectedTag);
}

export function collectUniqueTags(tasks: NekoEvent[]): string[] {
  const deduped = new Map<string, string>();

  for (const task of tasks) {
    for (const tag of normalizeTags(task.tags)) {
      const key = toTagKey(tag);
      if (!deduped.has(key)) {
        deduped.set(key, tag);
      }
    }
  }

  return Array.from(deduped.values()).sort((a, b) => a.localeCompare(b));
}

export function countTasksByTag(tasks: NekoEvent[], tag: string): number {
  return tasks.filter(task => taskHasTag(task, tag)).length;
}
