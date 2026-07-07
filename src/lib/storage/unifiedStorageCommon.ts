import { getStorageAdapter } from '@/lib/storage/adapter';
import { MAX_BOUNDED_ID_LIST_SCAN_RECORDS } from './unifiedStorageSaveTypes';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function normalizeSettingsNotesChatFloatingSize(
  value: unknown,
  fallback: NonNullable<UnifiedData['settings']['ui']>['notesChatFloatingSize'],
): NonNullable<UnifiedData['settings']['ui']>['notesChatFloatingSize'] {
  if (!isRecord(value)) {
    return fallback;
  }

  const { width, height } = value;
  if (typeof width !== 'number' || typeof height !== 'number') {
    return fallback;
  }
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    return fallback;
  }

  return {
    width: Math.max(
      SETTINGS_NOTES_CHAT_FLOATING_MIN_WIDTH,
      Math.min(SETTINGS_NOTES_CHAT_FLOATING_MAX_WIDTH, Math.round(width))
    ),
    height: Math.max(
      SETTINGS_NOTES_CHAT_FLOATING_MIN_HEIGHT,
      Math.min(SETTINGS_NOTES_CHAT_FLOATING_MAX_HEIGHT, Math.round(height))
    ),
  };
}

export function normalizeBoundedIdList(
  value: unknown,
  isSafeId: (item: unknown) => item is string,
  maxItems: number,
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const ids: string[] = [];
  const seen = new Set<string>();
  const scanLimit = Math.min(value.length, Math.max(maxItems, MAX_BOUNDED_ID_LIST_SCAN_RECORDS));
  for (let index = 0; index < scanLimit && ids.length < maxItems; index += 1) {
    const item = value[index];
    if (!isSafeId(item) || seen.has(item)) {
      continue;
    }
    seen.add(item);
    ids.push(item);
  }
  return ids;
}

export function normalizeBoundedString(value: unknown, maxChars: number): string {
  return typeof value === 'string' ? value.slice(0, maxChars) : '';
}

export function getSerializedByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

export function isSerializedWithinLimit(value: string, maxBytes: number): boolean {
  return getSerializedByteLength(value) <= maxBytes;
}

export function trimArrayForSerializedLimit<T>(
  items: T[],
  maxBytes: number,
  serialize: (items: T[]) => string,
): T[] {
  if (items.length === 0) {
    return items;
  }
  if (isSerializedWithinLimit(serialize(items), maxBytes)) {
    return items;
  }

  let low = 0;
  let high = items.length;
  let best: T[] = [];
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const candidate = items.slice(0, mid);
    if (isSerializedWithinLimit(serialize(candidate), maxBytes)) {
      best = candidate;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return best;
}

export async function mapWithConcurrencyLimit<T, R>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  const limit = Math.max(1, Math.min(items.length || 1, Math.floor(concurrency)));
  let nextIndex = 0;

  const workers = Array.from({ length: limit }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  });

  await Promise.all(workers);
  return results;
}

export async function readBoundedTextFile(
  storage: ReturnType<typeof getStorageAdapter>,
  path: string,
  maxBytes: number,
): Promise<string | null> {
  const fileInfo = await storage.stat(path).catch(() => null);
  if (
    fileInfo?.isFile === false ||
    fileInfo?.isDirectory === true ||
    (typeof fileInfo?.size === 'number' && (
      !Number.isFinite(fileInfo.size) ||
      fileInfo.size < 0 ||
      fileInfo.size > maxBytes
    ))
  ) {
    return null;
  }

  const content = await storage.readFile(path, maxBytes);
  return isSerializedWithinLimit(content, maxBytes) ? content : null;
}
