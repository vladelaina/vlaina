import { createAsyncPrefetchQueue } from '@/lib/asyncPrefetchQueue';
import type { NotesStore, NoteMetadataEntry } from '../types';
import { hasDraftUnsavedChanges, resolveDraftNoteTitle } from '../draftNote';
import {
  limitCachedNoteContents,
  setCachedNoteContent,
  type NoteContentCache,
} from '../document/noteContentCache';
import { pushNoteNavigationHistory } from '../document/noteNavigationHistory';
import type { NotesGet, NotesSet } from './workspaceSliceTypes';
import { hasInternalNotePathSegment } from '../utils/fs/internalNotePaths';
import { hasUnsafeNotesRootPathSegment } from '../utils/fs/notesRootPathContainment';

interface PendingNotePrefetch {
  promise: Promise<void>;
  started: boolean;
}

export const pendingNotePrefetches = new Map<string, PendingNotePrefetch>();
export const cancelledNotePrefetches = new Set<string>();
export const explicitOpenCancelledNotePrefetches = new Set<string>();
export const notePrefetchQueue = createAsyncPrefetchQueue(2);
export const MAX_PENDING_NOTE_PREFETCHES = 100;
export const MAX_NOTE_CONTENT_CACHE_ENTRIES = 250;
export const MAX_NOTE_CONTENT_CACHE_CHARS = 64 * 1024 * 1024;
export const HOVER_PREFETCH_FRESH_MS = 1000;
let latestOpenNoteRequestId = 0;

export function createOpenNoteRequestId() {
  latestOpenNoteRequestId += 1;
  return latestOpenNoteRequestId;
}

export function isLatestOpenNoteRequestId(openRequestId: number) {
  return openRequestId === latestOpenNoteRequestId;
}

export function getNotePrefetchKey(notesPath: string, path: string) {
  return `${notesPath}\0${path}`;
}

export async function awaitStartedOrCancelQueuedNotePrefetch(notesPath: string, path: string) {
  const prefetchKey = getNotePrefetchKey(notesPath, path);
  const pendingPrefetch = pendingNotePrefetches.get(prefetchKey);
  if (!pendingPrefetch) {
    return false;
  }

  if (!pendingPrefetch.started) {
    explicitOpenCancelledNotePrefetches.add(prefetchKey);
    return false;
  }

  try {
    await pendingPrefetch.promise;
  } catch {
    return false;
  }
  return true;
}

export function getProtectedCachePaths(state: NotesStore, extraPaths: string[] = []) {
  const protectedPaths = new Set(extraPaths);
  if (state.currentNote) {
    protectedPaths.add(state.currentNote.path);
  }
  state.openTabs.forEach((tab) => protectedPaths.add(tab.path));
  Object.keys(state.draftNotes).forEach((path) => protectedPaths.add(path));
  return protectedPaths;
}

export function limitWorkspaceNoteContents(cache: NoteContentCache, state: NotesStore, extraPaths: string[] = []) {
  return limitCachedNoteContents(
    cache,
    getProtectedCachePaths(state, extraPaths),
    MAX_NOTE_CONTENT_CACHE_ENTRIES,
    { maxContentChars: MAX_NOTE_CONTENT_CACHE_CHARS },
  );
}

export function preserveDirtyCurrentNoteContent(
  state: NotesStore,
  nextPath: string,
): NoteContentCache {
  const currentNote = state.currentNote;
  if (!state.isDirty || !currentNote || currentNote.path === nextPath) {
    return state.noteContentsCache;
  }

  const cachedEntry = state.noteContentsCache.get(currentNote.path);
  return setCachedNoteContent(
    state.noteContentsCache,
    currentNote.path,
    currentNote.content,
    cachedEntry?.modifiedAt ?? null,
    {
      baselineContent: cachedEntry?.savedContent ?? cachedEntry?.content ?? currentNote.content,
      ...(cachedEntry?.freshUntil !== undefined ? { freshUntil: cachedEntry.freshUntil } : {}),
      ...(cachedEntry?.size !== undefined ? { size: cachedEntry.size } : {}),
    },
  );
}

export function isCachedNoteFresh(state: NotesStore, path: string, now = Date.now()) {
  const freshUntil = state.noteContentsCache.get(path)?.freshUntil;
  return typeof freshUntil === 'number' && now <= freshUntil;
}

export function isInternalWorkspaceNotePath(path: string): boolean {
  return hasInternalNotePathSegment(path);
}

export function hasUnsafeWorkspaceNotePathSegment(path: string): boolean {
  return hasUnsafeNotesRootPathSegment(path);
}

export function openDraftNoteFromMemory(
  set: NotesSet,
  get: NotesGet,
  path: string,
  openInNewTab: boolean,
  updateNavigationHistory: boolean,
  error: string | null = null,
) {
  const {
    currentNote,
    currentNoteRevision,
    draftNotes,
    noteContentsCache,
    openTabs,
  } = get();
  const draftNote = draftNotes[path];
  if (!draftNote) {
    return false;
  }

  const existingTab = openTabs.find((tab) => tab.path === path);
  const content = currentNote?.path === path
    ? currentNote.content
    : noteContentsCache.get(path)?.content ?? '';
  const tabName = resolveDraftNoteTitle(draftNote.name);
  const shouldOpenInNewTab = openInNewTab || openTabs.length === 0;
  let updatedTabs = openTabs;

  if (existingTab) {
    updatedTabs = openTabs.map((tab) =>
      tab.path === path ? { ...tab, name: tabName } : tab,
    );
  } else if (shouldOpenInNewTab) {
    updatedTabs = [...openTabs, { path, name: tabName, isDirty: true }];
  } else {
    const currentTabIndex = openTabs.findIndex((tab) => tab.path === currentNote?.path);
    if (currentTabIndex !== -1) {
      updatedTabs = [...openTabs];
      updatedTabs[currentTabIndex] = { path, name: tabName, isDirty: true };
    } else {
      updatedTabs = [...openTabs, { path, name: tabName, isDirty: true }];
    }
  }

  const navigationHistoryUpdate = updateNavigationHistory
    ? pushNoteNavigationHistory(get(), path)
    : null;

  set({
    currentNote: { path, content },
    currentNoteRevision: currentNoteRevision + 1,
    workspaceRestoredNote: null,
    isDirty: existingTab?.isDirty ?? true,
    openTabs: updatedTabs,
    isNewlyCreated: false,
    error,
    ...(navigationHistoryUpdate ?? {}),
  });
  return true;
}

export function mergeOpenedTab(
  openTabs: NotesStore['openTabs'],
  currentNote: NotesStore['currentNote'],
  path: string,
  tabName: string,
  openInNewTab: boolean,
) {
  const existingTab = openTabs.find((tab) => tab.path === path);
  if (existingTab) {
    return openTabs.map((tab) => (tab.path === path ? { ...tab, name: tabName } : tab));
  }

  if (openInNewTab || openTabs.length === 0) {
    return [...openTabs, { path, name: tabName, isDirty: false }];
  }

  const currentTabIndex = openTabs.findIndex((tab) => tab.path === currentNote?.path);
  const currentTab = currentTabIndex === -1 ? null : openTabs[currentTabIndex];
  if (currentTabIndex !== -1 && currentTab && !currentTab.isDirty) {
    const updatedTabs = [...openTabs];
    updatedTabs[currentTabIndex] = { path, name: tabName, isDirty: false };
    return updatedTabs;
  }

  return [...openTabs, { path, name: tabName, isDirty: false }];
}

export function mergeLoadedNoteCacheEntry(
  latestCache: NoteContentCache,
  loadedCache: NoteContentCache,
  path: string,
  dirtyContent?: string,
): NoteContentCache {
  const loadedEntry = loadedCache.get(path);
  if (!loadedEntry) {
    return latestCache;
  }

  const hasDirtyContent = dirtyContent !== undefined;
  const options: Parameters<typeof setCachedNoteContent>[4] = {
    baselineContent: loadedEntry.savedContent ?? loadedEntry.content,
    freshUntil: loadedEntry.freshUntil,
  };
  if (loadedEntry.size !== undefined) {
    options.size = loadedEntry.size;
  }

  return setCachedNoteContent(
    latestCache,
    path,
    hasDirtyContent ? dirtyContent : loadedEntry.content,
    loadedEntry.modifiedAt,
    options,
  );
}

export function resolveLatestOpenedContent(
  state: NotesStore,
  path: string,
  loadedContent: string,
): { content: string; dirtyContent?: string } {
  const latestExistingTab = state.openTabs.find((tab) => tab.path === path);
  if (!latestExistingTab?.isDirty) {
    return { content: loadedContent };
  }

  const dirtyContent = state.currentNote?.path === path
    ? state.currentNote.content
    : state.noteContentsCache.get(path)?.content;
  return dirtyContent === undefined
    ? { content: loadedContent }
    : { content: dirtyContent, dirtyContent };
}

export function getDiscardableCurrentDraftPath(state: NotesStore, nextPath: string): string | null {
  const currentPath = state.currentNote?.path;
  if (!currentPath || currentPath === nextPath) {
    return null;
  }

  const draftNote = state.draftNotes[currentPath];
  if (!draftNote) {
    return null;
  }

  const content = state.currentNote?.content
    ?? state.noteContentsCache.get(currentPath)?.content
    ?? '';

  return hasDraftUnsavedChanges({
    draftName: draftNote.name,
    content,
    metadata: state.noteMetadata?.notes[currentPath],
  }) ? null : currentPath;
}

export function mergeLoadedNoteMetadata(
  loadedMetadata: NoteMetadataEntry,
  existingMetadata: NoteMetadataEntry | undefined,
): NoteMetadataEntry {
  return {
    ...loadedMetadata,
    createdAt: loadedMetadata.createdAt ?? existingMetadata?.createdAt,
    updatedAt: loadedMetadata.updatedAt ?? existingMetadata?.updatedAt,
  };
}
