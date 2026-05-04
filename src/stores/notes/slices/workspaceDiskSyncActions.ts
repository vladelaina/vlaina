import { getStorageAdapter, isAbsolutePath, joinPath } from '@/lib/storage/adapter';
import { createEmptyMetadataFile, setNoteEntry } from '../storage';
import {
  getCachedNoteModifiedAt,
  setCachedNoteContent,
} from '../document/noteContentCache';
import { setNoteTabDirtyState } from '../document/noteTabState';
import { buildSortedRootFolder } from '../utils/fs/rootFolderState';
import { readNoteMetadataFromMarkdown } from '../frontmatter';
import { logNotesDebug } from '../debugLog';
import { isDraftNotePath } from '../draftNote';
import type { NotesGet, NotesSet, WorkspaceSlice } from './workspaceSliceTypes';
import { normalizeSerializedMarkdownDocument } from '@/lib/notes/markdown/markdownSerializationUtils';

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
      if (!currentNote) return 'ignored';
      if (isDraftNotePath(currentNote.path)) {
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

        if (!isCurrentDiskSyncTarget(get, notesPath, currentNote.path)) {
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

          logNotesDebug('workspaceSlice:syncCurrentNoteFromDisk:deleted-conflict', {
            notePath: currentNote.path,
            wasDirty: isDirty,
          });
          return 'deleted-conflict';
        }

        const nextModifiedAt = fileInfo?.modifiedAt ?? cachedModifiedAt ?? null;
        if (!options?.force && nextModifiedAt === cachedModifiedAt) {
          return isCurrentDiskSyncTarget(get, notesPath, currentNote.path) ? 'unchanged' : 'ignored';
        }

        if (isDirty) {
          if (!isCurrentDiskSyncTarget(get, notesPath, currentNote.path)) {
            return 'ignored';
          }
          logNotesDebug('workspaceSlice:syncCurrentNoteFromDisk:conflict', {
            notePath: currentNote.path,
            cachedModifiedAt,
            nextModifiedAt,
          });
          set({ error: 'Current note changed outside vlaina while you still have unsaved changes.' });
          return 'conflict';
        }

        const nextContent = normalizeSerializedMarkdownDocument(await storage.readFile(fullPath));
        if (!isCurrentDiskSyncTarget(get, notesPath, currentNote.path)) {
          return 'ignored';
        }

        if (nextContent === currentNote.content && nextModifiedAt === cachedModifiedAt) {
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

        return 'reloaded';
      } catch (error) {
        if (!isCurrentDiskSyncTarget(get, notesPath, currentNote.path)) {
          return 'ignored';
        }
        logNotesDebug('workspaceSlice:syncCurrentNoteFromDisk:error', {
          notePath: currentNote.path,
          error,
        });
        set({ error: error instanceof Error ? error.message : 'Failed to sync note from disk' });
        return 'ignored';
      }
    },
  };
}
