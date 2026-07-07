import {
  RECENT_NOTES_KEY,
  NOTE_ICON_SIZE_KEY,
  MAX_RECENT_NOTES,
} from './constants';
import { normalizeRecentNotePaths } from './persistenceValidation';

const DEFAULT_NOTE_ICON_SIZE = 60;
const MAX_RECENT_NOTES_STORAGE_CHARS = 64 * 1024;

export function loadRecentNotes(): string[] {
  try {
    const saved = localStorage.getItem(RECENT_NOTES_KEY);
    if (saved && saved.length > MAX_RECENT_NOTES_STORAGE_CHARS) {
      return [];
    }
    return saved ? normalizeRecentNotePaths(JSON.parse(saved)) : [];
  } catch {
    return [];
  }
}

function saveRecentNotes(paths: string[]): void {
  try {
    localStorage.setItem(RECENT_NOTES_KEY, JSON.stringify(normalizeRecentNotePaths(paths)));
  } catch (error) {
  }
}

export function persistRecentNotes(paths: string[]): void {
  saveRecentNotes(paths);
}

function normalizeGlobalNoteIconSize(value: unknown): number {
  let parsed = Number.NaN;
  if (typeof value === 'number') {
    parsed = value;
  } else if (typeof value === 'string' && value.length <= 64) {
    const trimmed = value.trim();
    parsed = /^(?:\d+(?:\.\d+)?|\.\d+)$/.test(trimmed) ? Number(trimmed) : Number.NaN;
  }
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_NOTE_ICON_SIZE;
}

export function loadGlobalNoteIconSize(): number {
  try {
    return normalizeGlobalNoteIconSize(localStorage.getItem(NOTE_ICON_SIZE_KEY));
  } catch {
    return DEFAULT_NOTE_ICON_SIZE;
  }
}

export function persistGlobalNoteIconSize(size: number): number {
  const normalized = normalizeGlobalNoteIconSize(size);

  try {
    localStorage.setItem(NOTE_ICON_SIZE_KEY, String(normalized));
  } catch (error) {
  }

  return normalized;
}

export function addToRecentNotes(path: string, current: string[]): string[] {
  const normalizedPath = normalizeRecentNotePaths([path])[0];
  if (!normalizedPath) {
    return normalizeRecentNotePaths(current);
  }

  const filtered = normalizeRecentNotePaths(current).filter(p => p !== normalizedPath);
  const updated = [normalizedPath, ...filtered].slice(0, MAX_RECENT_NOTES);
  saveRecentNotes(updated);
  return updated;
}
