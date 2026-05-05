import { StateCreator } from 'zustand';
import { getNoteTitleFromPath } from '@/lib/notes/displayName';
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
  remapCachedNoteContents,
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
import { logLineBreakDebug, logNotesDebug, summarizeLineBreakText } from '../lineBreakDebugLog';
import { createWorkspaceDocumentActions } from './workspaceDocumentActions';
import { createWorkspaceExternalActions } from './workspaceExternalActions';
import { createWorkspaceTabActions } from './workspaceTabActions';
import type { NotesGet, NotesSet, WorkspaceSlice } from './workspaceSliceTypes';

const pendingNotePrefetches = new Map<string, Promise<void>>();
const notePrefetchQueue = createAsyncPrefetchQueue(2);
const MAX_NOTE_CONTENT_CACHE_ENTRIES = 250;
let latestOpenNoteRequestId = 0;

function getProtectedCachePaths(state: NotesStore, extraPaths: string[] = []) {
  const protectedPaths = new Set(extraPaths);
  if (state.currentNote) {
    protectedPaths.add(state.currentNote.path);
  }
  state.openTabs.forEach((tab) => protectedPaths.add(tab.path));
  Object.keys(state.draftNotes).forEach((path) => protectedPaths.add(path));
  return protectedPaths;
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
  logNotesDebug('NotesWorkspace', 'open-draft:from-memory', {
    path,
    openInNewTab,
    currentNotePath: currentNote?.path ?? null,
    existingTab: Boolean(existingTab),
    openTabsLength: openTabs.length,
    content: summarizeLineBreakText(content),
  });
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
    logLineBreakDebug('open-note:start-before-flush', {
      path,
      openInNewTab,
      currentNotePath: get().currentNote?.path ?? null,
      isDirty: get().isDirty,
      current: summarizeLineBreakText(get().currentNote?.content),
    });
    const flushed = flushCurrentPendingEditorMarkdown();
    logLineBreakDebug('open-note:after-flush', {
      path,
      flushed,
      currentNotePath: get().currentNote?.path ?? null,
      isDirty: get().isDirty,
      current: summarizeLineBreakText(get().currentNote?.content),
    });
    const openRequestId = ++latestOpenNoteRequestId;
    if (openDraftNoteFromMemory(set, get, path, openInNewTab)) {
      logNotesDebug('NotesWorkspace', 'open-note:draft-memory-complete', {
        path,
        currentNotePath: get().currentNote?.path ?? null,
        isDirty: get().isDirty,
      });
      return;
    }

    let { notesPath, isDirty, saveNote, recentNotes, openTabs, currentNote, noteContentsCache, draftNotes } = get();
    let shouldOpenInNewTab = openInNewTab;
    let existingTab = openTabs.find((t) => t.path === path);
    if (isDirty && currentNote && draftNotes[currentNote.path]) {
      shouldOpenInNewTab = true;
      logNotesDebug('NotesWorkspace', 'open-note:dirty-draft-forces-new-tab', {
        path,
        currentNotePath: currentNote.path,
      });
    }

    if (isDirty && !shouldOpenInNewTab && !existingTab) {
      logNotesDebug('NotesWorkspace', 'open-note:save-before-open', {
        path,
        notesPath,
        currentNotePath: currentNote?.path ?? null,
      });
      await saveNote();
      if (get().notesPath !== notesPath) {
        logNotesDebug('NotesWorkspace', 'open-note:aborted-vault-changed-after-save', {
          path,
          originalNotesPath: notesPath,
          latestNotesPath: get().notesPath,
        });
        return;
      }
      if (get().isDirty) {
        logNotesDebug('NotesWorkspace', 'open-note:aborted-still-dirty-after-save', {
          path,
          currentNotePath: get().currentNote?.path ?? null,
          isDirty: get().isDirty,
        });
        return;
      }
      ({ notesPath, recentNotes, openTabs, currentNote, noteContentsCache } = get());
      existingTab = openTabs.find((t) => t.path === path);
    }

    try {
      const { content, nextCache } = await loadNoteDocument({
        notesPath,
        path,
        cache: noteContentsCache,
      });
      logLineBreakDebug('open-note:loaded-target', {
        path,
        content: summarizeLineBreakText(content),
      });
      if (openRequestId !== latestOpenNoteRequestId || get().notesPath !== notesPath) {
        logNotesDebug('NotesWorkspace', 'open-note:stale-loaded-target', {
          path,
          openRequestId,
          latestOpenNoteRequestId,
          originalNotesPath: notesPath,
          latestNotesPath: get().notesPath,
        });
        return;
      }
      const nextMetadata = setNoteEntry(
        get().noteMetadata ?? createEmptyMetadataFile(),
        path,
        readNoteMetadataFromMarkdown(content)
      );
      const fileName = getNoteTitleFromPath(path);
      const tabName = fileName;
      const updatedRecent = addToRecentNotes(path, recentNotes);

      let updatedTabs = openTabs;
      if (existingTab) {
        updatedTabs = openTabs.map((t) => (t.path === path ? { ...t, name: tabName } : t));
      } else if (shouldOpenInNewTab || openTabs.length === 0) {
        updatedTabs = [...openTabs, { path, name: tabName, isDirty: false }];
      } else {
        const currentTabIndex = openTabs.findIndex((t) => t.path === currentNote?.path);
        if (currentTabIndex !== -1) {
          updatedTabs = [...openTabs];
          updatedTabs[currentTabIndex] = { path, name: tabName, isDirty: false };
        } else {
          updatedTabs = [...openTabs, { path, name: tabName, isDirty: false }];
        }
      }

      updateDisplayName(set, path, tabName);
      set({
        currentNote: { path, content },
        currentNoteRevision: get().currentNoteRevision + 1,
        isDirty: existingTab?.isDirty ?? false,
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
      logLineBreakDebug('open-note:set-target', {
        path,
        isDirty: existingTab?.isDirty ?? false,
        content: summarizeLineBreakText(content),
      });

      const { rootFolder, fileTreeSortMode } = get();
      persistWorkspaceSnapshot(notesPath, {
        rootFolder,
        currentNotePath: path,
        fileTreeSortMode,
      });
    } catch (error) {
      if (openRequestId === latestOpenNoteRequestId && get().notesPath === notesPath) {
        logNotesDebug('NotesWorkspace', 'open-note:failed', {
          path,
          message: error instanceof Error ? error.message : String(error),
        });
        set({ error: error instanceof Error ? error.message : 'Failed to open note' });
      }
    }
  },

  openNoteByAbsolutePath: async (absolutePath: string, openInNewTab: boolean = false) => {
    logLineBreakDebug('open-absolute:start-before-flush', {
      absolutePath,
      openInNewTab,
      currentNotePath: get().currentNote?.path ?? null,
      isDirty: get().isDirty,
      current: summarizeLineBreakText(get().currentNote?.content),
    });
    const flushed = flushCurrentPendingEditorMarkdown();
    logLineBreakDebug('open-absolute:after-flush', {
      absolutePath,
      flushed,
      currentNotePath: get().currentNote?.path ?? null,
      isDirty: get().isDirty,
      current: summarizeLineBreakText(get().currentNote?.content),
    });
    const openRequestId = ++latestOpenNoteRequestId;
    let { notesPath, isDirty, saveNote, openTabs, currentNote, noteContentsCache, draftNotes } = get();
    let shouldOpenInNewTab = openInNewTab;
    let existingTab = openTabs.find((t) => t.path === absolutePath);
    if (isDirty && currentNote && draftNotes[currentNote.path]) {
      shouldOpenInNewTab = true;
      logNotesDebug('NotesWorkspace', 'open-absolute:dirty-draft-forces-new-tab', {
        absolutePath,
        currentNotePath: currentNote.path,
      });
    }

    if (isDirty && !shouldOpenInNewTab && !existingTab) {
      logNotesDebug('NotesWorkspace', 'open-absolute:save-before-open', {
        absolutePath,
        notesPath,
        currentNotePath: currentNote?.path ?? null,
      });
      await saveNote();
      if (get().notesPath !== notesPath) {
        logNotesDebug('NotesWorkspace', 'open-absolute:aborted-vault-changed-after-save', {
          absolutePath,
          originalNotesPath: notesPath,
          latestNotesPath: get().notesPath,
        });
        return;
      }
      if (get().isDirty) {
        logNotesDebug('NotesWorkspace', 'open-absolute:aborted-still-dirty-after-save', {
          absolutePath,
          currentNotePath: get().currentNote?.path ?? null,
          isDirty: get().isDirty,
        });
        return;
      }
      ({ notesPath, openTabs, currentNote, noteContentsCache } = get());
      existingTab = openTabs.find((t) => t.path === absolutePath);
    }

    try {
      const { content, nextCache } = await loadNoteDocument({
        notesPath,
        path: absolutePath,
        cache: noteContentsCache,
      });
      logLineBreakDebug('open-absolute:loaded-target', {
        absolutePath,
        content: summarizeLineBreakText(content),
      });
      if (openRequestId !== latestOpenNoteRequestId || get().notesPath !== notesPath) {
        logNotesDebug('NotesWorkspace', 'open-absolute:stale-loaded-target', {
          absolutePath,
          openRequestId,
          latestOpenNoteRequestId,
          originalNotesPath: notesPath,
          latestNotesPath: get().notesPath,
        });
        return;
      }
      const nextMetadata = setNoteEntry(
        get().noteMetadata ?? createEmptyMetadataFile(),
        absolutePath,
        readNoteMetadataFromMarkdown(content)
      );
      const fileName = getNoteTitleFromPath(absolutePath);
      const tabName = fileName;

      let updatedTabs = openTabs;
      if (existingTab) {
        updatedTabs = openTabs.map((t) => (t.path === absolutePath ? { ...t, name: tabName } : t));
      } else if (shouldOpenInNewTab || openTabs.length === 0) {
        updatedTabs = [...openTabs, { path: absolutePath, name: tabName, isDirty: false }];
      } else {
        const currentTabIndex = openTabs.findIndex((t) => t.path === currentNote?.path);
        if (currentTabIndex !== -1) {
          updatedTabs = [...openTabs];
          updatedTabs[currentTabIndex] = { path: absolutePath, name: tabName, isDirty: false };
        } else {
          updatedTabs = [...openTabs, { path: absolutePath, name: tabName, isDirty: false }];
        }
      }

      updateDisplayName(set, absolutePath, tabName);
      set({
        currentNote: { path: absolutePath, content },
        currentNoteRevision: get().currentNoteRevision + 1,
        isDirty: existingTab?.isDirty ?? false,
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
      logLineBreakDebug('open-absolute:set-target', {
        absolutePath,
        isDirty: existingTab?.isDirty ?? false,
        content: summarizeLineBreakText(content),
      });
    } catch (error) {
      if (openRequestId === latestOpenNoteRequestId && get().notesPath === notesPath) {
        logNotesDebug('NotesWorkspace', 'open-absolute:failed', {
          absolutePath,
          message: error instanceof Error ? error.message : String(error),
        });
        set({ error: error instanceof Error ? error.message : 'Failed to open note' });
      }
    }
  },

  prefetchNote: async (path: string) => {
    const { notesPath, noteContentsCache } = get();
    if (noteContentsCache.has(path)) {
      return;
    }

    const prefetchKey = `${notesPath}\0${path}`;
    const existing = pendingNotePrefetches.get(prefetchKey);
    if (existing) {
      await existing;
      return;
    }

    const task = notePrefetchQueue.run(async () => {
      const { nextCache } = await loadNoteDocument({
        notesPath,
        path,
        cache: get().noteContentsCache,
      });
      const prefetchedEntry = nextCache.get(path);
      if (!prefetchedEntry) {
        return;
      }
      set((state) => {
        if (state.notesPath !== notesPath || state.noteContentsCache.has(path)) {
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

    pendingNotePrefetches.set(prefetchKey, task);
    try {
      await task;
    } catch {
      // Hover prefetch should not replace the explicit open-note error path.
    } finally {
      pendingNotePrefetches.delete(prefetchKey);
    }
  },

  adoptAbsoluteNoteIntoVault: (absolutePath: string, nextPath: string) => {
    const { currentNote, openTabs, noteContentsCache, noteMetadata, displayNames, recentNotes } = get();
    if (currentNote?.path !== absolutePath) {
      logNotesDebug('NotesWorkspace', 'adopt-absolute:skipped-not-current', {
        absolutePath,
        nextPath,
        currentNotePath: currentNote?.path ?? null,
      });
      return false;
    }
    logNotesDebug('NotesWorkspace', 'adopt-absolute:apply', {
      absolutePath,
      nextPath,
      openTabsLength: openTabs.length,
      cacheHasAbsolutePath: noteContentsCache.has(absolutePath),
      metadataHasAbsolutePath: Boolean(noteMetadata?.notes[absolutePath]),
    });

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

    logNotesDebug('NotesWorkspace', 'adopt-absolute:done', {
      absolutePath,
      nextPath,
      currentNotePath: get().currentNote?.path ?? null,
      openTabPaths: get().openTabs.map((tab) => tab.path),
    });
    return true;
  },

  ...createWorkspaceDocumentActions(set, get),
  ...createWorkspaceExternalActions(set, get),
  ...createWorkspaceTabActions(set, get),
});
