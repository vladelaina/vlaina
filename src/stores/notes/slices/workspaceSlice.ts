import { StateCreator } from 'zustand';
import { getNoteTitleFromPath } from '@/lib/notes/displayName';
import { isSupportedMarkdownPath } from '@/lib/notes/markdownFile';
import { createAsyncPrefetchQueue } from '@/lib/asyncPrefetchQueue';
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
} from '../document/noteContentCache';
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

interface PendingNotePrefetch {
  promise: Promise<void>;
  started: boolean;
}

const pendingNotePrefetches = new Map<string, PendingNotePrefetch>();
const cancelledNotePrefetches = new Set<string>();
const notePrefetchQueue = createAsyncPrefetchQueue(2);
const MAX_NOTE_CONTENT_CACHE_ENTRIES = 250;
const HOVER_PREFETCH_FRESH_MS = 1000;
let latestOpenNoteRequestId = 0;

function getNotePrefetchKey(notesPath: string, path: string) {
  return `${notesPath}\0${path}`;
}

async function awaitStartedNotePrefetch(notesPath: string, path: string) {
  const pendingPrefetch = pendingNotePrefetches.get(getNotePrefetchKey(notesPath, path));
  if (!pendingPrefetch?.started) {
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
      const reusedActivePrefetch = await awaitStartedNotePrefetch(notesPath, path);
      if (reusedActivePrefetch) {
        noteContentsCache = get().noteContentsCache;
      }

      const existingTabIsDirty = Boolean(get().openTabs.find((tab) => tab.path === path)?.isDirty);
      const { content, modifiedAt } = await loadNoteDocument({
        notesPath,
        path,
        cache: noteContentsCache,
        allowStaleCachedContent: existingTabIsDirty,
      });
      if (openRequestId !== latestOpenNoteRequestId || get().notesPath !== notesPath) {
        return;
      }
      const latestState = get();
      const latestOpenTabs = latestState.openTabs;
      const latestCurrentNote = latestState.currentNote;
      const latestExistingTab = latestOpenTabs.find((tab) => tab.path === path);
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
      const nextCache = setCachedNoteContent(latestState.noteContentsCache, path, content, modifiedAt, {
        updateBaseline: !latestExistingTab?.isDirty,
      });

      updateDisplayName(set, path, tabName);
      set({
        currentNote: { path, content },
        currentNoteRevision: latestState.currentNoteRevision + 1,
        isDirty: latestExistingTab?.isDirty ?? false,
        error: null,
        recentNotes: updatedRecent,
        openTabs: updatedTabs,
        isNewlyCreated: false,
        noteContentsCache: limitCachedNoteContents(
          nextCache,
          getProtectedCachePaths({ ...get(), openTabs: updatedTabs, currentNote: { path, content } }),
          MAX_NOTE_CONTENT_CACHE_ENTRIES,
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
    if (!isSupportedMarkdownPath(absolutePath)) {
      set({ error: 'Only Markdown files can be opened as notes.' });
      return;
    }
    const openRequestId = ++latestOpenNoteRequestId;
    let { notesPath, isDirty, saveNote, currentNote, noteContentsCache, draftNotes } = get();
    let shouldOpenInNewTab = openInNewTab;
    if (isDirty && currentNote && draftNotes[currentNote.path]) {
      shouldOpenInNewTab = true;
    }

    if (
      isDirty &&
      currentNote &&
      !draftNotes[currentNote.path] &&
      currentNote.path !== absolutePath
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
      const existingTabIsDirty = Boolean(get().openTabs.find((tab) => tab.path === absolutePath)?.isDirty);
      const { content, modifiedAt } = await loadNoteDocument({
        notesPath,
        path: absolutePath,
        cache: noteContentsCache,
        allowStaleCachedContent: existingTabIsDirty,
      });
      if (openRequestId !== latestOpenNoteRequestId || get().notesPath !== notesPath) {
        return;
      }
      const latestState = get();
      const latestOpenTabs = latestState.openTabs;
      const latestCurrentNote = latestState.currentNote;
      const latestExistingTab = latestOpenTabs.find((tab) => tab.path === absolutePath);
      const nextMetadata = setNoteEntry(
        latestState.noteMetadata ?? createEmptyMetadataFile(),
        absolutePath,
        readNoteMetadataFromMarkdown(content)
      );
      const fileName = getNoteTitleFromPath(absolutePath);
      const tabName = fileName;
      const updatedTabs = mergeOpenedTab(
        latestOpenTabs,
        latestCurrentNote,
        absolutePath,
        tabName,
        shouldOpenInNewTab,
      );
      const nextCache = setCachedNoteContent(latestState.noteContentsCache, absolutePath, content, modifiedAt, {
        updateBaseline: !latestExistingTab?.isDirty,
      });

      updateDisplayName(set, absolutePath, tabName);
      set({
        currentNote: { path: absolutePath, content },
        currentNoteRevision: latestState.currentNoteRevision + 1,
        isDirty: latestExistingTab?.isDirty ?? false,
        error: null,
        openTabs: updatedTabs,
        isNewlyCreated: false,
        noteContentsCache: limitCachedNoteContents(
          nextCache,
          getProtectedCachePaths({ ...get(), openTabs: updatedTabs, currentNote: { path: absolutePath, content } }),
          MAX_NOTE_CONTENT_CACHE_ENTRIES,
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
    if (isCachedNoteFresh(get(), path)) {
      return;
    }
    if (openTabs.some((tab) => tab.path === path && tab.isDirty)) {
      return;
    }

    const prefetchKey = getNotePrefetchKey(notesPath, path);
    cancelledNotePrefetches.delete(prefetchKey);
    const existing = pendingNotePrefetches.get(prefetchKey);
    if (existing) {
      await existing.promise;
      return;
    }

    const pendingPrefetch: PendingNotePrefetch = {
      promise: Promise.resolve(),
      started: false,
    };
    const task = notePrefetchQueue.run(async () => {
      pendingPrefetch.started = true;
      if (cancelledNotePrefetches.has(prefetchKey)) {
        return;
      }

      const { nextCache } = await loadNoteDocument({
        notesPath,
        path,
        cache: get().noteContentsCache,
      });
      if (cancelledNotePrefetches.has(prefetchKey)) {
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
    }
  },

  cancelPrefetchNote: (path: string) => {
    const { notesPath } = get();
    if (!notesPath) {
      return;
    }

    cancelledNotePrefetches.add(getNotePrefetchKey(notesPath, path));
  },

  adoptAbsoluteNoteIntoVault: (absolutePath: string, nextPath: string) => {
    const { currentNote, openTabs, noteContentsCache, noteMetadata, displayNames, recentNotes } = get();
    if (currentNote?.path !== absolutePath) {
      return false;
    }

    set({
      currentNote: remapCurrentNoteForExternalRename(currentNote, absolutePath, nextPath),
      currentNoteRevision: get().currentNoteRevision + 1,
      openTabs: remapOpenTabsForExternalRename(openTabs, absolutePath, nextPath),
      noteContentsCache: remapCachedNoteContents(noteContentsCache, (path) =>
        path === absolutePath ? nextPath : path
      ),
      noteMetadata: remapMetadataEntries(noteMetadata, (path) =>
        path === absolutePath ? nextPath : path
      ),
      displayNames: remapDisplayNamesForExternalRename(displayNames, absolutePath, nextPath),
      recentNotes: remapRecentNotesForExternalRename(recentNotes, absolutePath, nextPath),
    });
    return true;
  },

  ...createWorkspaceDocumentActions(set, get),
  ...createWorkspaceExternalActions(set, get),
  ...createWorkspaceTabActions(set, get),
});
