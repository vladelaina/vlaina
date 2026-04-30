import { normalizeNotePathKey } from '@/lib/notes/displayName';
import { logNotesDebug } from '../debugLog';

interface ExpectedExternalChange {
  path: string;
  recursive: boolean;
  expiresAt: number;
}

const EXPECTED_CHANGE_TTL_MS = 4000;

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

  expectedChanges.push({
    path: normalizedPath,
    recursive,
    expiresAt: now + EXPECTED_CHANGE_TTL_MS,
  });

  logNotesDebug('externalChangeRegistry:mark', {
    path: normalizedPath,
    recursive,
    pendingCount: expectedChanges.length,
  });
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
    expectedChanges.splice(matchedIndex, 1);
    logNotesDebug('externalChangeRegistry:ignore', {
      path: normalizedPath,
      pendingCount: expectedChanges.length,
    });
  }

  return matched;
}
