import { StateCreator } from 'zustand';
import { getNoteTitleFromPath } from '@/lib/notes/displayName';
import { isSupportedMarkdownPath } from '@/lib/notes/markdownFile';
import { createAsyncPrefetchQueue } from '@/lib/asyncPrefetchQueue';
import { isAbsolutePath, normalizeAbsolutePath } from '@/lib/storage/adapter';
import { NotesStore } from '../types';
import { updateDisplayName } from '../displayNameUtils';
import { resolveDraftNoteTitle } from '../draftNote';
import {
  addToRecentNotes,
  createEmptyMetadataFile,
  remapMetadataEntries,
  setNoteEntry,
} from '../storage';
import {
  limitCachedNoteContents,
  markCachedNoteFresh,
  remapCachedNoteContents,
  setCachedNoteContent,
  type NoteContentCache,
} from '../document/noteContentCache';
import {
  getExternalPathMutationRevision,
  wasPathExternallyMutatedSince,
} from '../document/externalPathMutationRegistry';
import { loadNoteDocument } from '../document/noteDocumentPersistence';
import {
  remapCurrentNoteForExternalRename,
  remapDisplayNamesForExternalRename,
  remapOpenTabsForExternalRename,
  remapRecentNotesForExternalRename,
} from '../document/externalPathSync';
import { persistWorkspaceSnapshot } from '../workspacePersistence';
import { readNoteMetadataFromMarkdown } from '../frontmatter';
import { flushCurrentPendingEditorMarkdown } from '../pendingEditorMarkdownFlusher';
import { createWorkspaceDocumentActions } from './workspaceDocumentActions';
import { createWorkspaceExternalActions } from './workspaceExternalActions';
import { createWorkspaceTabActions } from './workspaceTabActions';
import type { NotesGet, NotesSet, WorkspaceSlice } from './workspaceSliceTypes';
import { hasInternalNotePathSegment } from '../utils/fs/internalNotePaths';
import { hasUnsafeVaultPathSegment, normalizeVaultRelativePath } from '../utils/fs/vaultPathContainment';

interface PendingNotePrefetch {
  promise: Promise<void>;
  started: boolean;
}

const pendingNotePrefetches = new Map<string, PendingNotePrefetch>();
const cancelledNotePrefetches = new Set<string>();
const explicitOpenCancelledNotePrefetches = new Set<string>();
const notePrefetchQueue = createAsyncPrefetchQueue(2);
export const MAX_PENDING_NOTE_PREFETCHES = 100;
const MAX_NOTE_CONTENT_CACHE_ENTRIES = 250;
const MAX_NOTE_CONTENT_CACHE_CHARS = 64 * 1024 * 1024;
const HOVER_PREFETCH_FRESH_MS = 1000;
let latestOpenNoteRequestId = 0;

function getNotePrefetchKey(notesPath: string, path: string) {
  return `${notesPath}\0${path}`;
}

async function awaitStartedOrCancelQueuedNotePrefetch(notesPath: string, path: string) {
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

function getProtectedCachePaths(state: NotesStore, extraPaths: string[] = []) {
  const protectedPaths = new Set(extraPaths);
  if (state.currentNote) {
    protectedPaths.add(state.currentNote.path);
  }
  state.openTabs.forEach((tab) => protectedPaths.add(tab.path));
  Object.keys(state.draftNotes).forEach((path) => protectedPaths.add(path));
  return protectedPaths;
}

function isCachedNoteFresh(state: NotesStore, path: string, now = Date.now()) {
  const freshUntil = state.noteContentsCache.get(path)?.freshUntil;
  return typeof freshUntil === 'number' && now <= freshUntil;
}

function isInternalWorkspaceNotePath(path: string): boolean {
  return hasInternalNotePathSegment(path);
}

function hasUnsafeWorkspaceNotePathSegment(path: string): boolean {
  return hasUnsafeVaultPathSegment(path);
}

function openDraftNoteFromMemory(
  set: NotesSet,
  get: NotesGet,
  path: string,
  openInNewTab: boolean,
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

  set({
    currentNote: { path, content },
    currentNoteRevision: currentNoteRevision + 1,
    isDirty: existingTab?.isDirty ?? true,
    openTabs: updatedTabs,
    isNewlyCreated: false,
    error: null,
  });
  return true;
}

function mergeOpenedTab(
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

function mergeLoadedNoteCacheEntry(
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
    ...(hasDirtyContent
      ? { baselineContent: loadedEntry.savedContent ?? loadedEntry.content }
      : { updateBaseline: true }),
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

function resolveLatestOpenedContent(
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

export const createWorkspaceSlice: StateCreator<NotesStore, [], [], WorkspaceSlice> = (
  set,
  get
) => ({
  currentNote: null,
  currentNoteRevision: 0,
  currentNoteDiskRevision: 0,
  isDirty: false,
  isLoading: false,
  error: null,
  openTabs: [],
  recentlyClosedTabs: [],
  draftNotes: {},
  pendingDraftDiscardPath: null,
  displayNames: new Map(),

  openNote: async (path: string, openInNewTab: boolean = false) => {
    flushCurrentPendingEditorMarkdown();
    const openRequestId = ++latestOpenNoteRequestId;
    if (openDraftNoteFromMemory(set, get, path, openInNewTab)) {
      return;
    }
    if (!isSupportedMarkdownPath(path)) {
      set({ error: 'Only Markdown files can be opened as notes.' });
      return;
    }
    const normalizedPath = normalizeVaultRelativePath(path);
    if (normalizedPath == null) {
      set({ error: 'Path must stay inside the current vault.' });
      return;
    }
    if (isInternalWorkspaceNotePath(normalizedPath)) {
      set({ error: 'Path must not be inside an internal notes folder.' });
      return;
    }
    path = normalizedPath;
    const pathMutationRevision = getExternalPathMutationRevision();

    let { notesPath, isDirty, saveNote, recentNotes, currentNote, noteContentsCache, draftNotes } = get();
    let shouldOpenInNewTab = openInNewTab;
    if (isDirty && currentNote && draftNotes[currentNote.path]) {
      shouldOpenInNewTab = true;
    }

    if (
      isDirty &&
      currentNote &&
      !draftNotes[currentNote.path] &&
      currentNote.path !== path
    ) {
      await saveNote();
      if (get().notesPath !== notesPath) {
        return;
      }
      if (get().isDirty) {
        shouldOpenInNewTab = true;
      }
      ({ notesPath, recentNotes, currentNote, noteContentsCache } = get());
    }

    try {
      const reusedActivePrefetch = await awaitStartedOrCancelQueuedNotePrefetch(notesPath, path);
      if (reusedActivePrefetch) {
        noteContentsCache = get().noteContentsCache;
      }

      const existingTabIsDirty = Boolean(get().openTabs.find((tab) => tab.path === path)?.isDirty);
      const { content, nextCache: loadedCache } = await loadNoteDocument({
        notesPath,
        path,
        cache: noteContentsCache,
        allowStaleCachedContent: existingTabIsDirty,
      });
      if (openRequestId !== latestOpenNoteRequestId || get().notesPath !== notesPath) {
        return;
      }
      if (wasPathExternallyMutatedSince(path, pathMutationRevision)) {
        return;
      }
      const latestState = get();
      const latestOpenTabs = latestState.openTabs;
      const latestCurrentNote = latestState.currentNote;
      const latestExistingTab = latestOpenTabs.find((tab) => tab.path === path);
      const latestOpenedContent = resolveLatestOpenedContent(latestState, path, content);
      const nextMetadata = setNoteEntry(
        latestState.noteMetadata ?? createEmptyMetadataFile(),
        path,
        readNoteMetadataFromMarkdown(content)
      );
      const fileName = getNoteTitleFromPath(path);
      const tabName = fileName;
      const updatedRecent = addToRecentNotes(path, latestState.recentNotes ?? recentNotes);
      const updatedTabs = mergeOpenedTab(
        latestOpenTabs,
        latestCurrentNote,
        path,
        tabName,
        shouldOpenInNewTab,
      );
      const nextCache = mergeLoadedNoteCacheEntry(
        latestState.noteContentsCache,
        loadedCache,
        path,
        latestOpenedContent.dirtyContent,
      );

      updateDisplayName(set, path, tabName);
      set({
        currentNote: { path, content: latestOpenedContent.content },
        currentNoteRevision: latestState.currentNoteRevision + 1,
        isDirty: latestExistingTab?.isDirty ?? false,
        error: null,
        recentNotes: updatedRecent,
        openTabs: updatedTabs,
        isNewlyCreated: false,
        noteContentsCache: limitCachedNoteContents(
          nextCache,
          getProtectedCachePaths({
            ...get(),
            openTabs: updatedTabs,
            currentNote: { path, content: latestOpenedContent.content },
          }),
          MAX_NOTE_CONTENT_CACHE_ENTRIES,
          { maxContentChars: MAX_NOTE_CONTENT_CACHE_CHARS },
        ),
        noteMetadata: nextMetadata,
      });

      const { rootFolder, fileTreeSortMode } = get();
      persistWorkspaceSnapshot(notesPath, {
        rootFolder,
        currentNotePath: path,
        fileTreeSortMode,
      });
    } catch (error) {
      if (openRequestId === latestOpenNoteRequestId && get().notesPath === notesPath) {
        set({ error: error instanceof Error ? error.message : 'Failed to open note' });
      }
    }
  },

  openNoteByAbsolutePath: async (absolutePath: string, openInNewTab: boolean = false) => {
    flushCurrentPendingEditorMarkdown();
    const normalizedAbsolutePath = normalizeAbsolutePath(absolutePath);
    if (!isAbsolutePath(normalizedAbsolutePath)) {
      set({ error: 'Selected file path must be absolute' });
      return;
    }
    if (!isSupportedMarkdownPath(normalizedAbsolutePath)) {
      set({ error: 'Only Markdown files can be opened as notes.' });
      return;
    }
    if (isInternalWorkspaceNotePath(normalizedAbsolutePath)) {
      set({ error: 'Path must not be inside an internal notes folder.' });
      return;
    }
    if (hasUnsafeWorkspaceNotePathSegment(normalizedAbsolutePath)) {
      set({ error: 'Selected file path contains unsupported characters' });
      return;
    }
    const openRequestId = ++latestOpenNoteRequestId;
    const pathMutationRevision = getExternalPathMutationRevision();
    let { notesPath, isDirty, saveNote, currentNote, noteContentsCache, draftNotes } = get();
    let shouldOpenInNewTab = openInNewTab;
    if (isDirty && currentNote && draftNotes[currentNote.path]) {
      shouldOpenInNewTab = true;
    }

    if (
      isDirty &&
      currentNote &&
      !draftNotes[currentNote.path] &&
      currentNote.path !== normalizedAbsolutePath
    ) {
      await saveNote();
      if (get().notesPath !== notesPath) {
        return;
      }
      if (get().isDirty) {
        shouldOpenInNewTab = true;
      }
      ({ notesPath, currentNote, noteContentsCache } = get());
    }

    try {
      const existingTabIsDirty = Boolean(get().openTabs.find((tab) => tab.path === normalizedAbsolutePath)?.isDirty);
      const { content, nextCache: loadedCache } = await loadNoteDocument({
        notesPath,
        path: normalizedAbsolutePath,
        cache: noteContentsCache,
        allowStaleCachedContent: existingTabIsDirty,
      });
      if (openRequestId !== latestOpenNoteRequestId || get().notesPath !== notesPath) {
        return;
      }
      if (wasPathExternallyMutatedSince(normalizedAbsolutePath, pathMutationRevision)) {
        return;
      }
      const latestState = get();
      const latestOpenTabs = latestState.openTabs;
      const latestCurrentNote = latestState.currentNote;
      const latestExistingTab = latestOpenTabs.find((tab) => tab.path === normalizedAbsolutePath);
      const latestOpenedContent = resolveLatestOpenedContent(latestState, normalizedAbsolutePath, content);
      const nextMetadata = setNoteEntry(
        latestState.noteMetadata ?? createEmptyMetadataFile(),
        normalizedAbsolutePath,
        readNoteMetadataFromMarkdown(content)
      );
      const fileName = getNoteTitleFromPath(normalizedAbsolutePath);
      const tabName = fileName;
      const updatedTabs = mergeOpenedTab(
        latestOpenTabs,
        latestCurrentNote,
        normalizedAbsolutePath,
        tabName,
        shouldOpenInNewTab,
      );
      const nextCache = mergeLoadedNoteCacheEntry(
        latestState.noteContentsCache,
        loadedCache,
        normalizedAbsolutePath,
        latestOpenedContent.dirtyContent,
      );

      updateDisplayName(set, normalizedAbsolutePath, tabName);
      set({
        currentNote: { path: normalizedAbsolutePath, content: latestOpenedContent.content },
        currentNoteRevision: latestState.currentNoteRevision + 1,
        isDirty: latestExistingTab?.isDirty ?? false,
        error: null,
        openTabs: updatedTabs,
        isNewlyCreated: false,
        noteContentsCache: limitCachedNoteContents(
          nextCache,
          getProtectedCachePaths({
            ...get(),
            openTabs: updatedTabs,
            currentNote: { path: normalizedAbsolutePath, content: latestOpenedContent.content },
          }),
          MAX_NOTE_CONTENT_CACHE_ENTRIES,
          { maxContentChars: MAX_NOTE_CONTENT_CACHE_CHARS },
        ),
        noteMetadata: nextMetadata,
      });
    } catch (error) {
      if (openRequestId === latestOpenNoteRequestId && get().notesPath === notesPath) {
        set({ error: error instanceof Error ? error.message : 'Failed to open note' });
      }
    }
  },

  prefetchNote: async (path: string) => {
    const { notesPath, openTabs } = get();
    if (!isSupportedMarkdownPath(path)) {
      return;
    }
    const normalizedPath = normalizeVaultRelativePath(path);
    if (normalizedPath == null) {
      return;
    }
    if (isInternalWorkspaceNotePath(normalizedPath)) {
      return;
    }
    path = normalizedPath;
    if (isCachedNoteFresh(get(), path)) {
      return;
    }
    if (openTabs.some((tab) => tab.path === path && tab.isDirty)) {
      return;
    }
    const pathMutationRevision = getExternalPathMutationRevision();

    const prefetchKey = getNotePrefetchKey(notesPath, path);
    cancelledNotePrefetches.delete(prefetchKey);
    const existing = pendingNotePrefetches.get(prefetchKey);
    if (existing) {
      await existing.promise;
      return;
    }
    if (pendingNotePrefetches.size >= MAX_PENDING_NOTE_PREFETCHES) {
      return;
    }

    const pendingPrefetch: PendingNotePrefetch = {
      promise: Promise.resolve(),
      started: false,
    };
    const task = notePrefetchQueue.run(async () => {
      pendingPrefetch.started = true;
      if (cancelledNotePrefetches.has(prefetchKey) || explicitOpenCancelledNotePrefetches.has(prefetchKey)) {
        return;
      }

      const stateBeforeLoad = get();
      if (
        stateBeforeLoad.notesPath !== notesPath ||
        isCachedNoteFresh(stateBeforeLoad, path) ||
        stateBeforeLoad.currentNote?.path === path ||
        stateBeforeLoad.openTabs.some((tab) => tab.path === path && tab.isDirty)
      ) {
        return;
      }

      const { nextCache } = await loadNoteDocument({
        notesPath,
        path,
        cache: stateBeforeLoad.noteContentsCache,
      });
      if (
        cancelledNotePrefetches.has(prefetchKey) ||
        explicitOpenCancelledNotePrefetches.has(prefetchKey)
      ) {
        return;
      }
      if (wasPathExternallyMutatedSince(path, pathMutationRevision)) {
        return;
      }

      const freshCache = markCachedNoteFresh(nextCache, path, Date.now() + HOVER_PREFETCH_FRESH_MS);
      const prefetchedEntry = freshCache.get(path);
      if (!prefetchedEntry) {
        return;
      }
      set((state) => {
        if (
          state.notesPath !== notesPath ||
          state.openTabs.some((tab) => tab.path === path && tab.isDirty)
        ) {
          return {};
        }
        const mergedCache = new Map(state.noteContentsCache);
        mergedCache.set(path, prefetchedEntry);
        return {
          noteContentsCache: limitCachedNoteContents(
            mergedCache,
            getProtectedCachePaths(state, [path]),
            MAX_NOTE_CONTENT_CACHE_ENTRIES,
            { maxContentChars: MAX_NOTE_CONTENT_CACHE_CHARS },
          ),
        };
      });
    });
    pendingPrefetch.promise = task;

    pendingNotePrefetches.set(prefetchKey, pendingPrefetch);
    try {
      await task;
    } catch {
      // Hover prefetch should not replace the explicit open-note error path.
    } finally {
      pendingNotePrefetches.delete(prefetchKey);
      cancelledNotePrefetches.delete(prefetchKey);
      explicitOpenCancelledNotePrefetches.delete(prefetchKey);
    }
  },

  cancelPrefetchNote: (path: string) => {
    const { notesPath } = get();
    if (!notesPath) {
      return;
    }

    const normalizedPath = normalizeVaultRelativePath(path);
    if (normalizedPath == null) {
      return;
    }

    const prefetchKey = getNotePrefetchKey(notesPath, normalizedPath);
    const pendingPrefetch = pendingNotePrefetches.get(prefetchKey);
    if (!pendingPrefetch || pendingPrefetch.started) {
      return;
    }

    cancelledNotePrefetches.add(prefetchKey);
  },

  adoptAbsoluteNoteIntoVault: (absolutePath: string, nextPath: string) => {
    const { currentNote, openTabs, noteContentsCache, noteMetadata, displayNames, recentNotes } = get();
    const normalizedAbsolutePath = normalizeAbsolutePath(absolutePath);
    if (!isAbsolutePath(normalizedAbsolutePath) || currentNote?.path !== normalizedAbsolutePath) {
      return false;
    }
    if (!isSupportedMarkdownPath(nextPath)) {
      return false;
    }
    const normalizedNextPath = normalizeVaultRelativePath(nextPath);
    if (normalizedNextPath == null || isInternalWorkspaceNotePath(normalizedNextPath)) {
      return false;
    }

    set({
      currentNote: remapCurrentNoteForExternalRename(currentNote, normalizedAbsolutePath, normalizedNextPath),
      currentNoteRevision: get().currentNoteRevision + 1,
      openTabs: remapOpenTabsForExternalRename(openTabs, normalizedAbsolutePath, normalizedNextPath),
      noteContentsCache: remapCachedNoteContents(noteContentsCache, (path) =>
        path === normalizedAbsolutePath ? normalizedNextPath : path
      ),
      noteMetadata: remapMetadataEntries(noteMetadata, (path) =>
        path === normalizedAbsolutePath ? normalizedNextPath : path
      ),
      displayNames: remapDisplayNamesForExternalRename(displayNames, normalizedAbsolutePath, normalizedNextPath),
      recentNotes: remapRecentNotesForExternalRename(recentNotes, normalizedAbsolutePath, normalizedNextPath),
    });
    return true;
  },

  ...createWorkspaceDocumentActions(set, get),
  ...createWorkspaceExternalActions(set, get),
  ...createWorkspaceTabActions(set, get),
});
