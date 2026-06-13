import { getStorageAdapter, isAbsolutePath } from '@/lib/storage/adapter';
import { createEmptyMetadataFile, mergeNoteMetadataWithFileInfo, setNoteEntry } from '../storage';
import {
  getCachedNoteModifiedAt,
  getCachedNoteSize,
  setCachedNoteContent,
} from '../document/noteContentCache';
import { assertEditorSafeMarkdownContent } from '../document/noteDocumentPersistence';
import { shouldIgnoreExpectedExternalChange } from '../document/externalChangeRegistry';
import { setNoteTabDirtyState } from '../document/noteTabState';
import { buildSortedRootFolder } from '../utils/fs/rootFolderState';
import { readNoteMetadataFromMarkdown } from '../frontmatter';
import { isDraftNotePath } from '../draftNote';
import { hasInternalNotePathSegment } from '../utils/fs/internalNotePaths';
import { resolveVaultRelativeFullPath } from '../utils/fs/vaultPathContainment';
import type { NotesGet, NotesSet, WorkspaceSlice } from './workspaceSliceTypes';
import { normalizeSerializedMarkdownDocument } from '@/lib/notes/markdown/markdownSerializationUtils';
import { flushCurrentPendingEditorMarkdown } from '../pendingEditorMarkdownFlusher';

const MAX_NOTE_DISK_SYNC_BYTES = 10 * 1024 * 1024;
const diskSyncUtf8Encoder = new TextEncoder();

function isCurrentDiskSyncTarget(get: NotesGet, notesPath: string, notePath: string) {
  const state = get();
  return state.notesPath === notesPath && state.currentNote?.path === notePath;
}

function canReadDiskSyncNote(fileInfo: {
  isFile?: boolean;
  isDirectory?: boolean;
  size?: number | null;
} | null | undefined): boolean {
  const size = fileInfo?.size;
  return (
    fileInfo?.isDirectory !== true &&
    fileInfo?.isFile !== false &&
    Boolean(fileInfo) &&
    (
      typeof size !== 'number' ||
      (Number.isFinite(size) && size >= 0 && size <= MAX_NOTE_DISK_SYNC_BYTES)
    )
  );
}

function getKnownFileSize(fileInfo: { size?: number | null } | null | undefined): number | null {
  return typeof fileInfo?.size === 'number' && Number.isFinite(fileInfo.size) && fileInfo.size >= 0
    ? fileInfo.size
    : null;
}

function getKnownModifiedAt(fileInfo: { modifiedAt?: number | null } | null | undefined): number | null {
  return typeof fileInfo?.modifiedAt === 'number' && Number.isFinite(fileInfo.modifiedAt)
    ? fileInfo.modifiedAt
    : null;
}

function hasKnownFileSizeChanged(cachedSize: number | null, diskSize: number | null): boolean {
  return cachedSize !== null && diskSize !== null && cachedSize !== diskSize;
}

function assertDiskSyncContentWithinReadLimit(content: string): void {
  if (
    content.length > MAX_NOTE_DISK_SYNC_BYTES ||
    diskSyncUtf8Encoder.encode(content).length > MAX_NOTE_DISK_SYNC_BYTES
  ) {
    throw new Error('Current note is too large to reload from disk.');
  }
}

async function readNormalizedDiskSyncContent(
  storage: { readFile: (path: string, maxBytes?: number) => Promise<string> },
  fullPath: string,
): Promise<string> {
  const rawDiskContent = await storage.readFile(fullPath, MAX_NOTE_DISK_SYNC_BYTES);
  assertDiskSyncContentWithinReadLimit(rawDiskContent);
  assertEditorSafeMarkdownContent(rawDiskContent);
  return normalizeSerializedMarkdownDocument(rawDiskContent);
}

export function createWorkspaceDiskSyncAction(
  set: NotesSet,
  get: NotesGet
): Pick<WorkspaceSlice, 'syncCurrentNoteFromDisk'> {
  return {
    syncCurrentNoteFromDisk: async (options) => {
      const initialState = get();
      if (
        initialState.currentNote &&
        (
          hasInternalNotePathSegment(initialState.notesPath) ||
          hasInternalNotePathSegment(initialState.currentNote.path)
        )
      ) {
        set({ error: 'Path must not be inside an internal notes folder.' });
        return 'ignored';
      }

      flushCurrentPendingEditorMarkdown();
      const { currentNote, notesPath, isDirty, noteContentsCache, noteMetadata, rootFolder, fileTreeSortMode } = get();
      if (!currentNote) {
        return 'ignored';
      }
      if (isDraftNotePath(currentNote.path)) {
        return 'ignored';
      }
      if (hasInternalNotePathSegment(notesPath) || hasInternalNotePathSegment(currentNote.path)) {
        set({ error: 'Path must not be inside an internal notes folder.' });
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
        const cachedSize = getCachedNoteSize(noteContentsCache, currentNote.path);
        if (!isCurrentDiskSyncTarget(get, notesPath, currentNote.path)) {
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
          return 'deleted-conflict';
        }

        const nextModifiedAt = getKnownModifiedAt(fileInfo) ?? cachedModifiedAt ?? null;
        const nextSize = getKnownFileSize(fileInfo);
        const knownSizeChanged = hasKnownFileSizeChanged(cachedSize, nextSize);
        const shouldVerifyDiskContent = fileInfo != null && getKnownModifiedAt(fileInfo) === null;
        if (!options?.force && !shouldVerifyDiskContent && nextModifiedAt === cachedModifiedAt && !knownSizeChanged) {
          return isCurrentDiskSyncTarget(get, notesPath, currentNote.path) ? 'unchanged' : 'ignored';
        }

        if (!canReadDiskSyncNote(fileInfo)) {
          set({ error: 'Current note is too large to reload from disk.' });
          return 'ignored';
        }

        let preloadedDiskContent: string | null = null;
        const isExpectedExternalChange =
          Boolean(options?.expectedExternalChange) || shouldIgnoreExpectedExternalChange(fullPath);
        if (isExpectedExternalChange) {
          const latestState = get();
          const latestCurrentNote = latestState.currentNote;
          const latestContent = latestCurrentNote?.path === currentNote.path
            ? latestCurrentNote.content
            : currentNote.content;
          if (latestState.isDirty) {
            set({
              noteContentsCache: setCachedNoteContent(
                latestState.noteContentsCache,
                currentNote.path,
                latestContent,
                nextModifiedAt,
                { size: nextSize },
              ),
              error: null,
            });
            return 'ignored';
          }

          preloadedDiskContent = await readNormalizedDiskSyncContent(storage, fullPath);
          if (!isCurrentDiskSyncTarget(get, notesPath, currentNote.path)) {
            return 'ignored';
          }

          if (preloadedDiskContent === latestContent) {
            set({
              noteContentsCache: setCachedNoteContent(
                latestState.noteContentsCache,
                currentNote.path,
                latestContent,
                nextModifiedAt,
                { updateBaseline: true, size: nextSize },
              ),
              error: null,
            });
            return 'ignored';
          }
        }

        if (isDirty) {
          if (!isCurrentDiskSyncTarget(get, notesPath, currentNote.path)) {
            return 'ignored';
          }
          set({ error: null });
          return 'conflict';
        }

        let nextContent = preloadedDiskContent;
        if (nextContent === null) {
          nextContent = await readNormalizedDiskSyncContent(storage, fullPath);
        }
        if (!isCurrentDiskSyncTarget(get, notesPath, currentNote.path)) {
          return 'ignored';
        }

        const latestState = get();
        const latestCurrentNote = latestState.currentNote;
        const latestCachedModifiedAt = getCachedNoteModifiedAt(latestState.noteContentsCache, currentNote.path);
        if (
          !latestState.isDirty &&
          latestCurrentNote?.path === currentNote.path &&
          latestCurrentNote.content === nextContent
        ) {
          set({
            noteContentsCache: setCachedNoteContent(
              latestState.noteContentsCache,
              currentNote.path,
              nextContent,
              nextModifiedAt,
              { updateBaseline: true, size: nextSize },
            ),
            error: null,
          });
          return 'unchanged';
        }
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
            error: null,
          });
          return 'conflict';
        }

        if (nextContent === latestCurrentNote?.content && nextModifiedAt === latestCachedModifiedAt) {
          return 'unchanged';
        }

        const nextMetadata = setNoteEntry(
          latestState.noteMetadata ?? noteMetadata ?? createEmptyMetadataFile(),
          currentNote.path,
          mergeNoteMetadataWithFileInfo(readNoteMetadataFromMarkdown(nextContent), fileInfo)
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
            nextModifiedAt,
            { updateBaseline: true, size: nextSize },
          ),
          error: null,
        });
        return 'reloaded';
      } catch (error) {
        if (!isCurrentDiskSyncTarget(get, notesPath, currentNote.path)) {
          return 'ignored';
        }
        set({ error: error instanceof Error ? error.message : 'Failed to sync note from disk' });
        return 'ignored';
      }
    },
  };
}
