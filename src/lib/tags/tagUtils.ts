import { formatDateKey, getTodayKey } from '@/lib/date';

export const SYSTEM_TAG_PREFIX = '__system__:';
export const SYSTEM_TAG_TODAY = `${SYSTEM_TAG_PREFIX}today`;
export const SYSTEM_TAG_WEEK = `${SYSTEM_TAG_PREFIX}week`;

interface TagFilterableItem {
  tags?: string[] | null;
  lastUpdateDate?: string;
  history?: Record<string, number>;
}

interface TaggedTemporalItem {
  tags?: string[] | null;
  createdAt?: number;
  dtstart?: Date;
}

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

export function hasTag(tags: string[] | null | undefined, tag: string): boolean {
  const targetKey = toTagKey(tag);
  if (!targetKey) return false;

  const normalizedTags = normalizeTags(tags);
  return normalizedTags.some(item => toTagKey(item) === targetKey);
}

export function taskHasTag(task: TaggedTemporalItem, tag: string): boolean {
  return hasTag(task.tags, tag);
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

function parseDateKey(dateKey: string): Date | null {
  const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!matched) return null;

  const parsed = new Date(Number(matched[1]), Number(matched[2]) - 1, Number(matched[3]));
  if (Number.isNaN(parsed.getTime())) return null;
  if (formatDateKey(parsed) !== dateKey) return null;
  return parsed;
}

function hasTodayActivity(item: TagFilterableItem): boolean {
  const todayKey = getTodayKey();
  if (item.lastUpdateDate === todayKey) return true;
  const todayHistory = item.history?.[todayKey];
  return typeof todayHistory === 'number' && todayHistory > 0;
}

function hasCurrentWeekActivity(item: TagFilterableItem): boolean {
  if (item.lastUpdateDate) {
    const date = parseDateKey(item.lastUpdateDate);
    if (date && isInCurrentWeek(date)) return true;
  }

  if (!item.history) return false;
  return Object.entries(item.history).some(([dateKey, count]) => {
    if (typeof count !== 'number' || count <= 0) return false;
    const date = parseDateKey(dateKey);
    return !!date && isInCurrentWeek(date);
  });
}

function getTaskReferenceDate(task: TaggedTemporalItem): Date | null {
  if (typeof task.createdAt === 'number') {
    const createdAtDate = new Date(task.createdAt);
    if (!Number.isNaN(createdAtDate.getTime())) return createdAtDate;
  }

  if (task.dtstart) {
    const startDate = new Date(task.dtstart);
    if (!Number.isNaN(startDate.getTime())) return startDate;
  }

  return null;
}

export function matchesSelectedTag(task: TaggedTemporalItem, selectedTag: string | null): boolean {
  if (!selectedTag) return true;
  if (isTodaySystemTag(selectedTag)) {
    const referenceDate = getTaskReferenceDate(task);
    if (!referenceDate) return false;
    return formatDateKey(referenceDate) === getTodayKey();
  }
  if (isWeekSystemTag(selectedTag)) {
    const referenceDate = getTaskReferenceDate(task);
    if (!referenceDate) return false;
    return isInCurrentWeek(referenceDate);
  }
  return hasTag(task.tags, selectedTag);
}

export function matchesSelectedTagForProgressItem(
  item: TagFilterableItem,
  selectedTag: string | null
): boolean {
  if (!selectedTag) return true;
  if (isTodaySystemTag(selectedTag)) return hasTodayActivity(item);
  if (isWeekSystemTag(selectedTag)) return hasCurrentWeekActivity(item);
  return hasTag(item.tags, selectedTag);
}

export function collectUniqueTags(tasks: readonly TaggedTemporalItem[]): string[] {
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

export function countTasksByTag(tasks: readonly TaggedTemporalItem[], tag: string): number {
  return tasks.filter(task => taskHasTag(task, tag)).length;
}
