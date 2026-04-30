import { StateCreator } from 'zustand';
import { getNoteTitleFromPath } from '@/lib/notes/displayName';
import { NotesStore } from '../types';
import { updateDisplayName } from '../displayNameUtils';
import {
  addToRecentNotes,
  createEmptyMetadataFile,
  remapMetadataEntries,
  setNoteEntry,
} from '../storage';
import {
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
import { createWorkspaceDocumentActions } from './workspaceDocumentActions';
import { createWorkspaceExternalActions } from './workspaceExternalActions';
import { createWorkspaceTabActions } from './workspaceTabActions';
import type { WorkspaceSlice } from './workspaceSliceTypes';

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
    let { notesPath, isDirty, saveNote, recentNotes, openTabs, currentNote, noteContentsCache, draftNotes } = get();
    let shouldOpenInNewTab = openInNewTab;
    let existingTab = openTabs.find((t) => t.path === path);
    if (isDirty && currentNote && draftNotes[currentNote.path]) {
      shouldOpenInNewTab = true;
    }

    if (isDirty && !shouldOpenInNewTab && !existingTab) {
      await saveNote();
      if (get().isDirty) return;
      ({ notesPath, recentNotes, openTabs, currentNote, noteContentsCache } = get());
      existingTab = openTabs.find((t) => t.path === path);
    }

    try {
      const { content, nextCache } = await loadNoteDocument({
        notesPath,
        path,
        cache: noteContentsCache,
      });
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
        noteContentsCache: nextCache,
        noteMetadata: nextMetadata,
      });

      const { rootFolder, fileTreeSortMode } = get();
      persistWorkspaceSnapshot(notesPath, {
        rootFolder,
        currentNotePath: path,
        fileTreeSortMode,
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to open note' });
    }
  },

  openNoteByAbsolutePath: async (absolutePath: string, openInNewTab: boolean = false) => {
    let { notesPath, isDirty, saveNote, openTabs, currentNote, noteContentsCache, draftNotes } = get();
    let shouldOpenInNewTab = openInNewTab;
    let existingTab = openTabs.find((t) => t.path === absolutePath);
    if (isDirty && currentNote && draftNotes[currentNote.path]) {
      shouldOpenInNewTab = true;
    }

    if (isDirty && !shouldOpenInNewTab && !existingTab) {
      await saveNote();
      if (get().isDirty) return;
      ({ notesPath, openTabs, currentNote, noteContentsCache } = get());
      existingTab = openTabs.find((t) => t.path === absolutePath);
    }

    try {
      const { content, nextCache } = await loadNoteDocument({
        notesPath,
        path: absolutePath,
        cache: noteContentsCache,
      });
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
        noteContentsCache: nextCache,
        noteMetadata: nextMetadata,
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to open note' });
    }
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
