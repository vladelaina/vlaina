import { getNoteTitleFromPath } from '@/lib/notes/displayName';
import type { CurrentNoteState, NotesStore } from '../types';

function isPathWithin(path: string, basePath: string): boolean {
  return path === basePath || path.startsWith(`${basePath}/`);
}

function isPreservedDeletedPath(
  preservedPath: string | null | ReadonlySet<string> | undefined,
  path: string
): boolean {
  if (!preservedPath) {
    return false;
  }

  return typeof preservedPath === 'string'
    ? preservedPath === path
    : preservedPath.has(path);
}

export function remapPathForExternalRename(path: string, oldPath: string, newPath: string): string {
  if (path === oldPath) {
    return newPath;
  }

  if (path.startsWith(`${oldPath}/`)) {
    return `${newPath}${path.slice(oldPath.length)}`;
  }

  return path;
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
    const shouldUpdateTitle = tab.path === oldPath && tab.name === oldTitle;
    const nextTab = nextPath === tab.path
      ? tab
      : {
          ...tab,
          path: nextPath,
          name: shouldUpdateTitle ? newTitle : tab.name,
        };
    const existingIndex = tabIndexByPath.get(nextPath);
    if (existingIndex === undefined) {
      tabIndexByPath.set(nextPath, mergedTabs.length);
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
    if (nextPath !== path && path === oldPath && displayName === oldTitle) {
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

  return changed ? Array.from(new Set(nextRecentNotes)) : recentNotes;
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

  return changed ? Array.from(new Set(nextExpandedFolders)) : expandedFolders;
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
  _isDirty: boolean,
  deletedPath: string
): boolean {
  return Boolean(currentNote && shouldRemoveForExternalDeletion(currentNote.path, deletedPath));
}
