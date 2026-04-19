import { getNoteTitleFromPath } from '@/lib/notes/displayName';
import type { NoteTabState, RecentlyClosedTabState } from '../types';
import { remapPathForExternalRename, shouldRemoveForExternalDeletion } from './externalPathSync';

const MAX_RECENTLY_CLOSED_TABS = 20;

export function pushRecentlyClosedTab(
  recentlyClosedTabs: RecentlyClosedTabState[],
  tab: NoteTabState,
  index: number,
): RecentlyClosedTabState[] {
  const deduped = recentlyClosedTabs.filter((entry) => entry.tab.path !== tab.path);
  return [{ tab, index }, ...deduped].slice(0, MAX_RECENTLY_CLOSED_TABS);
}

export function remapRecentlyClosedTabsForExternalRename(
  recentlyClosedTabs: RecentlyClosedTabState[],
  oldPath: string,
  newPath: string,
): RecentlyClosedTabState[] {
  const oldTitle = getNoteTitleFromPath(oldPath);
  const newTitle = getNoteTitleFromPath(newPath);
  const seenPaths = new Set<string>();
  const nextTabs: RecentlyClosedTabState[] = [];

  for (const entry of recentlyClosedTabs) {
    const nextPath = remapPathForExternalRename(entry.tab.path, oldPath, newPath);
    if (seenPaths.has(nextPath)) {
      continue;
    }

    seenPaths.add(nextPath);
    nextTabs.push({
      ...entry,
      tab: {
        ...entry.tab,
        path: nextPath,
        name: entry.tab.path === oldPath && entry.tab.name === oldTitle ? newTitle : entry.tab.name,
      },
    });
  }

  return nextTabs;
}

export function pruneRecentlyClosedTabsForExternalDeletion(
  recentlyClosedTabs: RecentlyClosedTabState[],
  deletedPath: string,
): RecentlyClosedTabState[] {
  return recentlyClosedTabs.filter((entry) => !shouldRemoveForExternalDeletion(entry.tab.path, deletedPath));
}

export function restoreClosedTabOrder(
  openTabs: NoteTabState[],
  path: string,
  index: number,
): NoteTabState[] {
  const currentIndex = openTabs.findIndex((tab) => tab.path === path);
  if (currentIndex === -1) {
    return openTabs;
  }

  const targetIndex = Math.max(0, Math.min(index, openTabs.length - 1));
  if (currentIndex === targetIndex) {
    return openTabs;
  }

  const nextTabs = [...openTabs];
  const [restoredTab] = nextTabs.splice(currentIndex, 1);
  if (!restoredTab) {
    return openTabs;
  }

  nextTabs.splice(targetIndex, 0, restoredTab);
  return nextTabs;
}
