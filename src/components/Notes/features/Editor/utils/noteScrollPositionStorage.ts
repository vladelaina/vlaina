import { isAbsolutePath } from '@/lib/storage/adapter';
import { isDraftNotePath } from '@/stores/notes/draftNote';

export const NOTE_SCROLL_POSITION_STORAGE_KEY = 'vlaina-note-scroll-positions';

const MAX_NOTE_SCROLL_POSITION_ENTRIES = 1000;
const MAX_NOTE_SCROLL_POSITION_STORAGE_CHARS = 256 * 1024;
const MAX_NOTE_SCROLL_POSITION_PATH_CHARS = 4096;
const MAX_NOTE_SCROLL_TOP = 100_000_000;

interface StoredNoteScrollPosition {
  scrollTop: number;
  updatedAt: number;
}

type StoredNoteScrollPositions = Record<string, StoredNoteScrollPosition>;

function getStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function normalizePathValue(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed || trimmed.length > MAX_NOTE_SCROLL_POSITION_PATH_CHARS) {
    return null;
  }
  return trimmed;
}

function getStorageIdentity(notesPath: string | null | undefined, notePath: string | null | undefined): string | null {
  const normalizedNotePath = normalizePathValue(notePath);
  if (!normalizedNotePath || isDraftNotePath(normalizedNotePath)) {
    return null;
  }

  if (isAbsolutePath(normalizedNotePath)) {
    return JSON.stringify(['absolute', normalizedNotePath]);
  }

  const normalizedNotesPath = normalizePathValue(notesPath) ?? '';
  return JSON.stringify([normalizedNotesPath, normalizedNotePath]);
}

function normalizeScrollTop(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return null;
  }
  return Math.min(MAX_NOTE_SCROLL_TOP, Math.round(value));
}

function normalizeUpdatedAt(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : 0;
}

function readStoredPositions(): StoredNoteScrollPositions {
  const storage = getStorage();
  if (!storage) {
    return {};
  }

  try {
    const saved = storage.getItem(NOTE_SCROLL_POSITION_STORAGE_KEY);
    if (!saved || saved.length > MAX_NOTE_SCROLL_POSITION_STORAGE_CHARS) {
      return {};
    }

    const parsed: unknown = JSON.parse(saved);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }

    const positions: StoredNoteScrollPositions = {};
    for (const [key, entry] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof key !== 'string' || key.length > MAX_NOTE_SCROLL_POSITION_PATH_CHARS * 2 + 16) {
        continue;
      }
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        continue;
      }

      const candidate = entry as Record<string, unknown>;
      const scrollTop = normalizeScrollTop(candidate.scrollTop);
      if (scrollTop === null) {
        continue;
      }

      positions[key] = {
        scrollTop,
        updatedAt: normalizeUpdatedAt(candidate.updatedAt),
      };
    }
    return trimStoredPositions(positions);
  } catch {
    return {};
  }
}

function serializeStoredPositions(positions: StoredNoteScrollPositions): string {
  return JSON.stringify(positions);
}

function trimStoredPositions(positions: StoredNoteScrollPositions): StoredNoteScrollPositions {
  let entries = Object.entries(positions)
    .sort((left, right) => right[1].updatedAt - left[1].updatedAt)
    .slice(0, MAX_NOTE_SCROLL_POSITION_ENTRIES);

  let trimmed = Object.fromEntries(entries) as StoredNoteScrollPositions;
  while (
    entries.length > 0 &&
    serializeStoredPositions(trimmed).length > MAX_NOTE_SCROLL_POSITION_STORAGE_CHARS
  ) {
    entries = entries.slice(0, -1);
    trimmed = Object.fromEntries(entries) as StoredNoteScrollPositions;
  }

  return trimmed;
}

function writeStoredPositions(positions: StoredNoteScrollPositions): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  try {
    storage.setItem(NOTE_SCROLL_POSITION_STORAGE_KEY, serializeStoredPositions(trimStoredPositions(positions)));
  } catch {
  }
}

export function loadPersistedNoteScrollPosition(
  notesPath: string | null | undefined,
  notePath: string | null | undefined,
): number | null {
  const identity = getStorageIdentity(notesPath, notePath);
  if (!identity) {
    return null;
  }

  return readStoredPositions()[identity]?.scrollTop ?? null;
}

export function persistNoteScrollPosition(
  notesPath: string | null | undefined,
  notePath: string | null | undefined,
  scrollTop: number,
): void {
  const identity = getStorageIdentity(notesPath, notePath);
  const normalizedScrollTop = normalizeScrollTop(scrollTop);
  if (!identity || normalizedScrollTop === null) {
    return;
  }

  const positions = readStoredPositions();
  positions[identity] = {
    scrollTop: normalizedScrollTop,
    updatedAt: Date.now(),
  };
  writeStoredPositions(positions);
}
