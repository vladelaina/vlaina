import type { NotesStore } from '../types';
import {
  getExternalPathComparisonKey,
  isSameExternalPath,
  remapPathForExternalRename,
  shouldRemoveForExternalDeletion,
} from './externalPathSync';

export const MAX_NOTE_NAVIGATION_HISTORY_ENTRIES = 80;

export interface NoteNavigationHistoryUpdate {
  noteNavigationHistory: string[];
  noteNavigationHistoryIndex: number;
}

function normalizeHistoryEntries(entries: readonly string[] | null | undefined): string[] {
  return Array.isArray(entries) ? [...entries] : [];
}

function clampHistoryIndex(entries: readonly string[] | null | undefined, index: number): number {
  const normalizedEntries = normalizeHistoryEntries(entries);
  if (normalizedEntries.length === 0) {
    return -1;
  }

  if (!Number.isFinite(index)) {
    return normalizedEntries.length - 1;
  }

  return Math.max(0, Math.min(normalizedEntries.length - 1, Math.trunc(index)));
}

function pathsMatch(path: string, otherPath: string): boolean {
  return getExternalPathComparisonKey(path) === getExternalPathComparisonKey(otherPath);
}

export function pushNoteNavigationHistory(
  state: Pick<NotesStore, 'currentNote' | 'noteNavigationHistory' | 'noteNavigationHistoryIndex'>,
  nextPath: string,
): NoteNavigationHistoryUpdate {
  const existingEntries = normalizeHistoryEntries(state.noteNavigationHistory);
  const existingIndex = clampHistoryIndex(existingEntries, state.noteNavigationHistoryIndex);
  const currentPath = state.currentNote?.path ?? null;

  if (existingEntries.length === 0) {
    const seededEntries = currentPath && !pathsMatch(currentPath, nextPath)
      ? [currentPath, nextPath]
      : [nextPath];
    return {
      noteNavigationHistory: seededEntries,
      noteNavigationHistoryIndex: seededEntries.length - 1,
    };
  }

  if (existingIndex >= 0 && pathsMatch(existingEntries[existingIndex]!, nextPath)) {
    return {
      noteNavigationHistory: existingEntries,
      noteNavigationHistoryIndex: existingIndex,
    };
  }

  const baseEntries = existingEntries.slice(0, existingIndex + 1);
  const nextEntries = [...baseEntries, nextPath];
  const overflow = Math.max(0, nextEntries.length - MAX_NOTE_NAVIGATION_HISTORY_ENTRIES);
  const boundedEntries = overflow > 0 ? nextEntries.slice(overflow) : nextEntries;

  return {
    noteNavigationHistory: boundedEntries,
    noteNavigationHistoryIndex: boundedEntries.length - 1,
  };
}

export function remapNoteNavigationHistoryForExternalRename(
  entries: string[],
  index: number,
  oldPath: string,
  newPath: string,
): NoteNavigationHistoryUpdate {
  const safeEntries = normalizeHistoryEntries(entries);
  const currentIndex = clampHistoryIndex(safeEntries, index);
  const nextEntries: string[] = [];
  let nextIndex = -1;

  safeEntries.forEach((path, entryIndex) => {
    const nextPath = remapPathForExternalRename(path, oldPath, newPath);
    const previousPath = nextEntries[nextEntries.length - 1];
    const collapsedIntoPrevious = previousPath !== undefined && pathsMatch(previousPath, nextPath);

    if (!collapsedIntoPrevious) {
      nextEntries.push(nextPath);
    }

    if (entryIndex === currentIndex) {
      nextIndex = nextEntries.length - 1;
    }
  });

  return {
    noteNavigationHistory: nextEntries,
    noteNavigationHistoryIndex: clampHistoryIndex(nextEntries, nextIndex),
  };
}

export function pruneNoteNavigationHistoryForExternalDeletion(
  entries: string[],
  index: number,
  deletedPath: string,
  preservedPath?: string | null | ReadonlySet<string>,
): NoteNavigationHistoryUpdate {
  const safeEntries = normalizeHistoryEntries(entries);
  const currentIndex = clampHistoryIndex(safeEntries, index);
  const nextEntries: string[] = [];
  let nextIndex = currentIndex;

  safeEntries.forEach((path, entryIndex) => {
    const preserved = typeof preservedPath === 'string'
      ? isSameExternalPath(preservedPath, path)
      : preservedPath
        ? Array.from(preservedPath).some((preservedEntry) => isSameExternalPath(preservedEntry, path))
        : false;
    const shouldRemove = !preserved && shouldRemoveForExternalDeletion(path, deletedPath);

    if (shouldRemove) {
      if (entryIndex < currentIndex) {
        nextIndex -= 1;
      } else if (entryIndex === currentIndex) {
        nextIndex = nextEntries.length;
      }
      return;
    }

    const previousPath = nextEntries[nextEntries.length - 1];
    if (previousPath !== undefined && pathsMatch(previousPath, path)) {
      if (entryIndex <= currentIndex) {
        nextIndex = nextEntries.length - 1;
      }
      return;
    }

    nextEntries.push(path);
  });

  return {
    noteNavigationHistory: nextEntries,
    noteNavigationHistoryIndex: clampHistoryIndex(nextEntries, nextIndex),
  };
}
