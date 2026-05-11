import { getStorageAdapter, isAbsolutePath } from '@/lib/storage/adapter';
import { createEmptyMetadataFile, setNoteEntry } from '../storage';
import {
  getCachedNoteModifiedAt,
  setCachedNoteContent,
} from '../document/noteContentCache';
import { setNoteTabDirtyState } from '../document/noteTabState';
import { buildSortedRootFolder } from '../utils/fs/rootFolderState';
import { readNoteMetadataFromMarkdown } from '../frontmatter';
import { isDraftNotePath } from '../draftNote';
import { resolveVaultRelativeFullPath } from '../utils/fs/vaultPathContainment';
import type { NotesGet, NotesSet, WorkspaceSlice } from './workspaceSliceTypes';
import { normalizeSerializedMarkdownDocument } from '@/lib/notes/markdown/markdownSerializationUtils';
import {
  compareLineBreakText,
  logNotesDebug,
  summarizeLineBreakText,
} from '../lineBreakDebugLog';
import { flushCurrentPendingEditorMarkdown } from '../pendingEditorMarkdownFlusher';

const MAX_NOTE_DISK_SYNC_BYTES = 10 * 1024 * 1024;

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
      flushCurrentPendingEditorMarkdown();
      const { currentNote, notesPath, isDirty, noteContentsCache, noteMetadata, rootFolder, fileTreeSortMode } = get();
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
          : (await resolveVaultRelativeFullPath(notesPath, currentNote.path)).fullPath;
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
          const latestState = get();
          const latestCurrentNote = latestState.currentNote;
          const latestContent = latestCurrentNote?.path === currentNote.path
            ? latestCurrentNote.content
            : currentNote.content;
          const latestCachedModifiedAt = getCachedNoteModifiedAt(
            latestState.noteContentsCache,
            currentNote.path,
          ) ?? cachedModifiedAt;
          const updatedTabs = setNoteTabDirtyState(latestState.openTabs, currentNote.path, true);
          set({
            currentNote: latestCurrentNote?.path === currentNote.path
              ? { path: currentNote.path, content: latestContent }
              : latestCurrentNote,
            isDirty: true,
            openTabs: updatedTabs,
            noteContentsCache: setCachedNoteContent(
              latestState.noteContentsCache,
              currentNote.path,
              latestContent,
              latestCachedModifiedAt
            ),
            error: isDirty
              ? 'Current note was deleted outside vlaina while you still have unsaved changes.'
              : 'Current note is missing on disk. Its content is preserved in the editor; save to restore it.',
          });

          logNotesDebug('NotesDiskSync', 'sync:deleted-conflict', {
            notePath: currentNote.path,
            wasDirty: isDirty,
            current: summarizeLineBreakText(latestContent),
          });
          return 'deleted-conflict';
        }

        if (fileInfo?.size && fileInfo.size > MAX_NOTE_DISK_SYNC_BYTES) {
          set({ error: 'Current note is too large to reload from disk.' });
          logNotesDebug('NotesDiskSync', 'sync:ignored-too-large', {
            notePath: currentNote.path,
            fullPath,
            size: fileInfo.size,
          });
          return 'ignored';
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

        const latestState = get();
        const latestCurrentNote = latestState.currentNote;
        const latestCachedModifiedAt = getCachedNoteModifiedAt(latestState.noteContentsCache, currentNote.path);
        const hasLocalEditDuringSync =
          Boolean(latestState.isDirty) ||
          latestCurrentNote?.content !== currentNote.content;
        if (hasLocalEditDuringSync) {
          const latestContent = latestCurrentNote?.content ?? currentNote.content;
          set({
            isDirty: true,
            openTabs: setNoteTabDirtyState(latestState.openTabs, currentNote.path, true),
            noteContentsCache: setCachedNoteContent(
              latestState.noteContentsCache,
              currentNote.path,
              latestContent,
              latestCachedModifiedAt ?? cachedModifiedAt,
            ),
            error: 'Current note changed outside vlaina while you still have unsaved changes.',
          });
          logNotesDebug('NotesDiskSync', 'sync:conflict-local-edit-during-read', {
            notePath: currentNote.path,
            previous: summarizeLineBreakText(currentNote.content),
            latest: summarizeLineBreakText(latestContent),
            disk: summarizeLineBreakText(nextContent),
            nextModifiedAt,
            cachedModifiedAt,
          });
          return 'conflict';
        }

        if (nextContent === latestCurrentNote?.content && nextModifiedAt === latestCachedModifiedAt) {
          logNotesDebug('NotesDiskSync', 'sync:unchanged-content-and-modified-at', {
            notePath: currentNote.path,
            nextModifiedAt,
          });
          return 'unchanged';
        }

        const nextMetadata = setNoteEntry(
          latestState.noteMetadata ?? noteMetadata ?? createEmptyMetadataFile(),
          currentNote.path,
          readNoteMetadataFromMarkdown(nextContent)
        );
        const latestRootFolder = latestState.rootFolder ?? rootFolder;
        const latestSortMode = latestState.fileTreeSortMode ?? fileTreeSortMode;
        const nextRootFolder = buildSortedRootFolder(
          latestRootFolder,
          latestRootFolder?.children ?? [],
          latestSortMode,
          nextMetadata,
        );
        set({
          currentNote: { path: currentNote.path, content: nextContent },
          currentNoteDiskRevision: latestState.currentNoteDiskRevision + 1,
          isDirty: false,
          openTabs: setNoteTabDirtyState(latestState.openTabs, currentNote.path, false),
          noteMetadata: nextMetadata,
          rootFolder: nextRootFolder,
          noteContentsCache: setCachedNoteContent(
            latestState.noteContentsCache,
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
