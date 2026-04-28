import { getStorageAdapter, isAbsolutePath, joinPath } from '@/lib/storage/adapter';
import { createEmptyMetadataFile, setNoteEntry } from '../storage';
import {
  getCachedNoteModifiedAt,
  removeCachedNoteContent,
  setCachedNoteContent,
} from '../document/noteContentCache';
import { setNoteTabDirtyState } from '../document/noteTabState';
import { openStoredNotePath } from '../openNotePath';
import { buildSortedRootFolder } from '../utils/fs/rootFolderState';
import { readNoteMetadataFromMarkdown } from '../frontmatter';
import { logNotesDebug } from '../debugLog';
import type { NotesGet, NotesSet, WorkspaceSlice } from './workspaceSliceTypes';

export function createWorkspaceDiskSyncAction(
  set: NotesSet,
  get: NotesGet
): Pick<WorkspaceSlice, 'syncCurrentNoteFromDisk'> {
  return {
    syncCurrentNoteFromDisk: async () => {
      const { currentNote, notesPath, isDirty, noteContentsCache, openTabs, noteMetadata, rootFolder, fileTreeSortMode } = get();
      if (!currentNote) return 'ignored';

      try {
        const storage = getStorageAdapter();
        const fullPath = isAbsolutePath(currentNote.path)
          ? currentNote.path
          : await joinPath(notesPath, currentNote.path);
        const exists = await storage.exists(fullPath);
        const fileInfo = await storage.stat(fullPath);
        const cachedModifiedAt = getCachedNoteModifiedAt(noteContentsCache, currentNote.path);

        if (!exists || fileInfo?.isFile === false) {
          if (isDirty) {
            logNotesDebug('workspaceSlice:syncCurrentNoteFromDisk:deleted-conflict', {
              notePath: currentNote.path,
            });
            set({ error: 'Current note was deleted outside vlaina while you still have unsaved changes.' });
            return 'deleted-conflict';
          }

          const updatedTabs = openTabs.filter((tab) => tab.path !== currentNote.path);
          set({
            currentNote: null,
            isDirty: false,
            openTabs: updatedTabs,
            noteContentsCache: removeCachedNoteContent(noteContentsCache, currentNote.path),
            error: null,
          });

          if (updatedTabs.length > 0) {
            const lastTab = updatedTabs[updatedTabs.length - 1];
            if (lastTab) {
              void openStoredNotePath(lastTab.path, {
                openNote: get().openNote,
                openNoteByAbsolutePath: get().openNoteByAbsolutePath,
              });
            }
          }

          logNotesDebug('workspaceSlice:syncCurrentNoteFromDisk:deleted', {
            notePath: currentNote.path,
            remainingTabCount: updatedTabs.length,
          });
          return 'deleted';
        }

        const nextModifiedAt = fileInfo?.modifiedAt ?? cachedModifiedAt ?? null;
        if (nextModifiedAt === cachedModifiedAt) return 'unchanged';

        if (isDirty) {
          logNotesDebug('workspaceSlice:syncCurrentNoteFromDisk:conflict', {
            notePath: currentNote.path,
            cachedModifiedAt,
            nextModifiedAt,
          });
          set({ error: 'Current note changed outside vlaina while you still have unsaved changes.' });
          return 'conflict';
        }

        const nextContent = await storage.readFile(fullPath);
        const nextMetadata = setNoteEntry(
          noteMetadata ?? createEmptyMetadataFile(),
          currentNote.path,
          readNoteMetadataFromMarkdown(nextContent)
        );
        const nextRootFolder = buildSortedRootFolder(rootFolder, rootFolder?.children ?? [], fileTreeSortMode, nextMetadata);
        set({
          currentNote: { path: currentNote.path, content: nextContent },
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

        logNotesDebug('workspaceSlice:syncCurrentNoteFromDisk:reloaded', {
          notePath: currentNote.path,
          cachedModifiedAt,
          nextModifiedAt,
          contentLength: nextContent.length,
        });
        return 'reloaded';
      } catch (error) {
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
