import { getStorageAdapter, isAbsolutePath, joinPath } from '@/lib/storage/adapter';
import { createEmptyMetadataFile, setNoteEntry } from '../storage';
import {
  getCachedNoteModifiedAt,
  setCachedNoteContent,
} from '../document/noteContentCache';
import { setNoteTabDirtyState } from '../document/noteTabState';
import { buildSortedRootFolder } from '../utils/fs/rootFolderState';
import { readNoteMetadataFromMarkdown } from '../frontmatter';
import { isDraftNotePath } from '../draftNote';
import type { NotesGet, NotesSet, WorkspaceSlice } from './workspaceSliceTypes';
import { normalizeSerializedMarkdownDocument } from '@/lib/notes/markdown/markdownSerializationUtils';
import {
  compareLineBreakText,
  logNotesDebug,
  summarizeLineBreakText,
} from '../lineBreakDebugLog';

function isCurrentDiskSyncTarget(get: NotesGet, notesPath: string, notePath: string) {
  const state = get();
  return state.notesPath === notesPath && state.currentNote?.path === notePath;
}

export function createWorkspaceDiskSyncAction(
  set: NotesSet,
  get: NotesGet
): Pick<WorkspaceSlice, 'syncCurrentNoteFromDisk'> {
  return {
    syncCurrentNoteFromDisk: async (options) => {
      const { currentNote, notesPath, isDirty, noteContentsCache, openTabs, noteMetadata, rootFolder, fileTreeSortMode } = get();
      logNotesDebug('NotesDiskSync', 'sync:start', {
        options: options ?? null,
        currentNotePath: currentNote?.path ?? null,
        notesPath,
        isDirty,
      });
      if (!currentNote) {
        logNotesDebug('NotesDiskSync', 'sync:ignored-no-current-note');
        return 'ignored';
      }
      if (isDraftNotePath(currentNote.path)) {
        logNotesDebug('NotesDiskSync', 'sync:ignored-draft', {
          notePath: currentNote.path,
        });
        return 'ignored';
      }

      try {
        const storage = getStorageAdapter();
        const fullPath = isAbsolutePath(currentNote.path)
          ? currentNote.path
          : await joinPath(notesPath, currentNote.path);
        const exists = await storage.exists(fullPath);
        const fileInfo = await storage.stat(fullPath);
        const cachedModifiedAt = getCachedNoteModifiedAt(noteContentsCache, currentNote.path);
        logNotesDebug('NotesDiskSync', 'sync:stat', {
          notePath: currentNote.path,
          fullPath,
          exists,
          fileInfo,
          cachedModifiedAt,
        });

        if (!isCurrentDiskSyncTarget(get, notesPath, currentNote.path)) {
          logNotesDebug('NotesDiskSync', 'sync:ignored-stale-after-stat', {
            notePath: currentNote.path,
            currentNotePath: get().currentNote?.path ?? null,
            latestNotesPath: get().notesPath,
          });
          return 'ignored';
        }

        if (!exists || fileInfo?.isFile === false) {
          const updatedTabs = setNoteTabDirtyState(openTabs, currentNote.path, true);
          set({
            currentNote,
            isDirty: true,
            openTabs: updatedTabs,
            noteContentsCache: setCachedNoteContent(
              noteContentsCache,
              currentNote.path,
              currentNote.content,
              cachedModifiedAt
            ),
            error: isDirty
              ? 'Current note was deleted outside vlaina while you still have unsaved changes.'
              : 'Current note is missing on disk. Its content is preserved in the editor; save to restore it.',
          });

          logNotesDebug('NotesDiskSync', 'sync:deleted-conflict', {
            notePath: currentNote.path,
            wasDirty: isDirty,
            current: summarizeLineBreakText(currentNote.content),
          });
          return 'deleted-conflict';
        }

        const nextModifiedAt = fileInfo?.modifiedAt ?? cachedModifiedAt ?? null;
        if (!options?.force && nextModifiedAt === cachedModifiedAt) {
          logNotesDebug('NotesDiskSync', 'sync:unchanged-modified-at', {
            notePath: currentNote.path,
            nextModifiedAt,
            cachedModifiedAt,
          });
          return isCurrentDiskSyncTarget(get, notesPath, currentNote.path) ? 'unchanged' : 'ignored';
        }

        if (isDirty) {
          if (!isCurrentDiskSyncTarget(get, notesPath, currentNote.path)) {
            logNotesDebug('NotesDiskSync', 'sync:ignored-stale-dirty-conflict', {
              notePath: currentNote.path,
            });
            return 'ignored';
          }
          set({ error: 'Current note changed outside vlaina while you still have unsaved changes.' });
          logNotesDebug('NotesDiskSync', 'sync:conflict-dirty', {
            notePath: currentNote.path,
            current: summarizeLineBreakText(currentNote.content),
            nextModifiedAt,
            cachedModifiedAt,
          });
          return 'conflict';
        }

        const rawDiskContent = await storage.readFile(fullPath);
        const nextContent = normalizeSerializedMarkdownDocument(rawDiskContent);
        logNotesDebug('NotesDiskSync', 'sync:read-disk-content', {
          notePath: currentNote.path,
          raw: summarizeLineBreakText(rawDiskContent),
          normalized: summarizeLineBreakText(nextContent),
          diffRawToNormalized: compareLineBreakText(rawDiskContent, nextContent),
          diffCurrentToNext: compareLineBreakText(currentNote.content, nextContent),
        });
        if (!isCurrentDiskSyncTarget(get, notesPath, currentNote.path)) {
          logNotesDebug('NotesDiskSync', 'sync:ignored-stale-after-read', {
            notePath: currentNote.path,
            currentNotePath: get().currentNote?.path ?? null,
            latestNotesPath: get().notesPath,
          });
          return 'ignored';
        }

        if (nextContent === currentNote.content && nextModifiedAt === cachedModifiedAt) {
          logNotesDebug('NotesDiskSync', 'sync:unchanged-content-and-modified-at', {
            notePath: currentNote.path,
            nextModifiedAt,
          });
          return 'unchanged';
        }

        const nextMetadata = setNoteEntry(
          noteMetadata ?? createEmptyMetadataFile(),
          currentNote.path,
          readNoteMetadataFromMarkdown(nextContent)
        );
        const nextRootFolder = buildSortedRootFolder(rootFolder, rootFolder?.children ?? [], fileTreeSortMode, nextMetadata);
        set({
          currentNote: { path: currentNote.path, content: nextContent },
          currentNoteDiskRevision: get().currentNoteDiskRevision + 1,
          isDirty: false,
          openTabs: setNoteTabDirtyState(openTabs, currentNote.path, false),
          noteMetadata: nextMetadata,
          rootFolder: nextRootFolder,
          noteContentsCache: setCachedNoteContent(
            noteContentsCache,
            currentNote.path,
            nextContent,
            nextModifiedAt
          ),
          error: null,
        });

        logNotesDebug('NotesDiskSync', 'sync:reloaded', {
          notePath: currentNote.path,
          previous: summarizeLineBreakText(currentNote.content),
          next: summarizeLineBreakText(nextContent),
          diff: compareLineBreakText(currentNote.content, nextContent),
          nextModifiedAt,
        });
        return 'reloaded';
      } catch (error) {
        if (!isCurrentDiskSyncTarget(get, notesPath, currentNote.path)) {
          logNotesDebug('NotesDiskSync', 'sync:ignored-error-stale', {
            notePath: currentNote.path,
            message: error instanceof Error ? error.message : String(error),
          });
          return 'ignored';
        }
        set({ error: error instanceof Error ? error.message : 'Failed to sync note from disk' });
        logNotesDebug('NotesDiskSync', 'sync:failed', {
          notePath: currentNote.path,
          message: error instanceof Error ? error.message : String(error),
        });
        return 'ignored';
      }
    },
  };
}
