import { normalizeNotePathKey } from '@/lib/notes/displayName';

interface ExpectedExternalChange {
  path: string;
  recursive: boolean;
  createdAt: number;
  expiresAt: number;
  remainingEvents: number;
}

const EXPECTED_CHANGE_TTL_MS = 1000;
const EXPECTED_CHANGE_MAX_EVENTS = 2;

let expectedChanges: ExpectedExternalChange[] = [];

function pruneExpiredExpectedChanges(now: number) {
  expectedChanges = expectedChanges.filter((entry) => entry.expiresAt > now);
}

export function markExpectedExternalChange(path: string, recursive = false): void {
  const normalizedPath = normalizeNotePathKey(path);
  if (!normalizedPath) {
    return;
  }

  const now = Date.now();
  pruneExpiredExpectedChanges(now);

  const existing = expectedChanges.find((entry) =>
    entry.path === normalizedPath && entry.recursive === recursive
  );
  if (existing) {
    existing.createdAt = now;
    existing.expiresAt = now + EXPECTED_CHANGE_TTL_MS;
    existing.remainingEvents = EXPECTED_CHANGE_MAX_EVENTS;
  } else {
    expectedChanges.push({
      path: normalizedPath,
      recursive,
      createdAt: now,
      expiresAt: now + EXPECTED_CHANGE_TTL_MS,
      remainingEvents: EXPECTED_CHANGE_MAX_EVENTS,
    });
  }

}

export function shouldIgnoreExpectedExternalChange(path: string): boolean {
  const normalizedPath = normalizeNotePathKey(path);
  if (!normalizedPath) {
    return false;
  }

  const now = Date.now();
  pruneExpiredExpectedChanges(now);

  const matchedIndex = expectedChanges.findIndex((entry) => {
    if (entry.path === normalizedPath) {
      return true;
    }

    return entry.recursive && normalizedPath.startsWith(`${entry.path}/`);
  });
  const matched = matchedIndex !== -1;

  if (matched) {
    const entry = expectedChanges[matchedIndex];
    entry.remainingEvents -= 1;
    if (entry.remainingEvents <= 0) {
      expectedChanges.splice(matchedIndex, 1);
    }
  }

  return matched;
}
