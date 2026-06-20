import { getNoteTitleFromPath, normalizeNotePathKey } from '@/lib/notes/displayName';
import { isAbsolutePath } from '@/lib/storage/adapter';
import type { CurrentNoteState, NotesStore } from '../types';

function normalizeExternalAbsolutePath(path: string): string | null {
  const normalized = normalizeNotePathKey(path) ?? path;
  return isAbsolutePath(normalized) ? normalized : null;
}

export function getExternalPathComparisonKey(path: string): string {
  const normalized = normalizeExternalAbsolutePath(path);
  if (!normalized) {
    return path;
  }

  return /^[A-Za-z]:\//.test(normalized) || normalized.startsWith('//')
    ? normalized.toLowerCase()
    : normalized;
}

export function isSameExternalPath(path: string, otherPath: string): boolean {
  const normalizedPath = normalizeExternalAbsolutePath(path);
  const normalizedOtherPath = normalizeExternalAbsolutePath(otherPath);
  if (!normalizedPath || !normalizedOtherPath) {
    return path === otherPath;
  }

  return getExternalPathComparisonKey(normalizedPath) === getExternalPathComparisonKey(normalizedOtherPath);
}

function getPathWithinSuffix(path: string, basePath: string): string | null {
  const normalizedPath = normalizeExternalAbsolutePath(path);
  const normalizedBasePath = normalizeExternalAbsolutePath(basePath);
  if (!normalizedPath || !normalizedBasePath) {
    if (path === basePath) {
      return '';
    }
    return path.startsWith(`${basePath}/`) ? path.slice(basePath.length) : null;
  }

  const pathKey = getExternalPathComparisonKey(normalizedPath);
  const basePathKey = getExternalPathComparisonKey(normalizedBasePath);
  if (pathKey === basePathKey) {
    return '';
  }

  const childPrefix = basePathKey.endsWith('/') ? basePathKey : `${basePathKey}/`;
  return pathKey.startsWith(childPrefix)
    ? normalizedPath.slice(normalizedBasePath.length)
    : null;
}

function isPathWithin(path: string, basePath: string): boolean {
  return getPathWithinSuffix(path, basePath) != null;
}

function isPreservedDeletedPath(
  preservedPath: string | null | ReadonlySet<string> | undefined,
  path: string
): boolean {
  if (!preservedPath) {
    return false;
  }

  if (typeof preservedPath === 'string') {
    return isSameExternalPath(preservedPath, path);
  }

  for (const preserved of preservedPath) {
    if (isSameExternalPath(preserved, path)) {
      return true;
    }
  }
  return false;
}

export function remapPathForExternalRename(path: string, oldPath: string, newPath: string): string {
  const suffix = getPathWithinSuffix(path, oldPath);
  if (suffix == null) {
    return path;
  }

  if (!suffix) {
    return newPath;
  }

  return newPath.endsWith('/') || suffix.startsWith('/')
    ? `${newPath}${suffix}`
    : `${newPath}/${suffix}`;
}

export function shouldRemoveForExternalDeletion(path: string, deletedPath: string): boolean {
  return isPathWithin(path, deletedPath);
}

export function remapOpenTabsForExternalRename(
  openTabs: NotesStore['openTabs'],
  oldPath: string,
  newPath: string
): NotesStore['openTabs'] {
  const oldTitle = getNoteTitleFromPath(oldPath);
  const newTitle = getNoteTitleFromPath(newPath);
  const mergedTabs: NotesStore['openTabs'] = [];
  const tabIndexByPath = new Map<string, number>();

  for (const tab of openTabs) {
    const nextPath = remapPathForExternalRename(tab.path, oldPath, newPath);
    const tabTitle = getNoteTitleFromPath(tab.path);
    const shouldUpdateTitle =
      isSameExternalPath(tab.path, oldPath) &&
      (tab.name === oldTitle || tab.name === tabTitle);
    const nextTab = nextPath === tab.path
      ? tab
      : {
          ...tab,
          path: nextPath,
          name: shouldUpdateTitle ? newTitle : tab.name,
        };
    const existingIndex = tabIndexByPath.get(getExternalPathComparisonKey(nextPath));
    if (existingIndex === undefined) {
      tabIndexByPath.set(getExternalPathComparisonKey(nextPath), mergedTabs.length);
      mergedTabs.push(nextTab);
      continue;
    }

    const existingTab = mergedTabs[existingIndex]!;
    const defaultName = getNoteTitleFromPath(nextPath);
    mergedTabs[existingIndex] = {
      ...existingTab,
      isDirty: existingTab.isDirty || nextTab.isDirty,
      name: existingTab.name === defaultName && nextTab.name !== defaultName
        ? nextTab.name
        : existingTab.name,
    };
  }

  return mergedTabs;
}

export function pruneOpenTabsForExternalDeletion(
  openTabs: NotesStore['openTabs'],
  deletedPath: string,
  preservedPath?: string | null | ReadonlySet<string>
): NotesStore['openTabs'] {
  return openTabs.filter((tab) => {
    if (isPreservedDeletedPath(preservedPath, tab.path)) {
      return true;
    }
    return !shouldRemoveForExternalDeletion(tab.path, deletedPath);
  });
}

export function remapDisplayNamesForExternalRename(
  displayNames: NotesStore['displayNames'],
  oldPath: string,
  newPath: string
): NotesStore['displayNames'] {
  const nextDisplayNames = new Map<string, string>();
  const oldTitle = getNoteTitleFromPath(oldPath);
  const newTitle = getNoteTitleFromPath(newPath);

  for (const [path, displayName] of displayNames.entries()) {
    const nextPath = remapPathForExternalRename(path, oldPath, newPath);
    const pathTitle = getNoteTitleFromPath(path);
    if (
      nextPath !== path &&
      isSameExternalPath(path, oldPath) &&
      (displayName === oldTitle || displayName === pathTitle)
    ) {
      nextDisplayNames.set(nextPath, newTitle);
      continue;
    }

    nextDisplayNames.set(nextPath, displayName);
  }

  return nextDisplayNames;
}

export function pruneDisplayNamesForExternalDeletion(
  displayNames: NotesStore['displayNames'],
  deletedPath: string,
  preservedPath?: string | null | ReadonlySet<string>
): NotesStore['displayNames'] {
  const nextDisplayNames = new Map<string, string>();

  for (const [path, displayName] of displayNames.entries()) {
    if (isPreservedDeletedPath(preservedPath, path)) {
      nextDisplayNames.set(path, displayName);
      continue;
    }

    if (!shouldRemoveForExternalDeletion(path, deletedPath)) {
      nextDisplayNames.set(path, displayName);
    }
  }

  return nextDisplayNames;
}

export function remapRecentNotesForExternalRename(
  recentNotes: NotesStore['recentNotes'],
  oldPath: string,
  newPath: string
): NotesStore['recentNotes'] {
  let changed = false;

  const nextRecentNotes = recentNotes.map((path) => {
    const nextPath = remapPathForExternalRename(path, oldPath, newPath);
    if (nextPath !== path) {
      changed = true;
    }
    return nextPath;
  });

  if (!changed) {
    return recentNotes;
  }

  const seenPaths = new Set<string>();
  return nextRecentNotes.filter((path) => {
    const key = getExternalPathComparisonKey(path);
    if (seenPaths.has(key)) {
      return false;
    }
    seenPaths.add(key);
    return true;
  });
}

export function remapExpandedFoldersForExternalRename(
  expandedFolders: string[],
  oldPath: string,
  newPath: string
): string[] {
  let changed = false;

  const nextExpandedFolders = expandedFolders.map((path) => {
    const nextPath = remapPathForExternalRename(path, oldPath, newPath);
    if (nextPath !== path) {
      changed = true;
    }
    return nextPath;
  });

  if (!changed) {
    return expandedFolders;
  }

  const seenPaths = new Set<string>();
  return nextExpandedFolders.filter((path) => {
    const key = getExternalPathComparisonKey(path);
    if (seenPaths.has(key)) {
      return false;
    }
    seenPaths.add(key);
    return true;
  });
}

export function pruneRecentNotesForExternalDeletion(
  recentNotes: NotesStore['recentNotes'],
  deletedPath: string,
  preservedPath?: string | null | ReadonlySet<string>
): NotesStore['recentNotes'] {
  const nextRecentNotes = recentNotes.filter((path) => {
    if (isPreservedDeletedPath(preservedPath, path)) {
      return true;
    }

    return !shouldRemoveForExternalDeletion(path, deletedPath);
  });

  return nextRecentNotes.length === recentNotes.length ? recentNotes : nextRecentNotes;
}

export function pruneExpandedFoldersForExternalDeletion(
  expandedFolders: string[],
  deletedPath: string
): string[] {
  const nextExpandedFolders = expandedFolders.filter(
    (path) => !shouldRemoveForExternalDeletion(path, deletedPath)
  );

  return nextExpandedFolders.length === expandedFolders.length ? expandedFolders : nextExpandedFolders;
}

export function remapCurrentNoteForExternalRename(
  currentNote: CurrentNoteState | null,
  oldPath: string,
  newPath: string
): CurrentNoteState | null {
  if (!currentNote) {
    return currentNote;
  }

  const nextPath = remapPathForExternalRename(currentNote.path, oldPath, newPath);
  return nextPath === currentNote.path ? currentNote : { ...currentNote, path: nextPath };
}

export function shouldPreserveDeletedCurrentNote(
  currentNote: CurrentNoteState | null,
  isDirty: boolean,
  deletedPath: string
): boolean {
  return Boolean(isDirty && currentNote && shouldRemoveForExternalDeletion(currentNote.path, deletedPath));
}
