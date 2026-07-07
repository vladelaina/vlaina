import { isSupportedMarkdownPath } from '@/lib/notes/markdownFile';
import { isAbsolutePath } from '@/lib/storage/adapter';
import type { StateCreator } from 'zustand';
import { getCachedNoteModifiedAt, setCachedNoteContent } from '../document/noteContentCache';
import {
  assertEditorSafeMarkdownContent,
  saveNoteDocument,
} from '../document/noteDocumentPersistence';
import { setNoteTabDirtyState } from '../document/noteTabState';
import { isDraftNotePath } from '../draftNote';
import {
  createEmptyMetadataFile,
  mergeNoteMetadataWithFileInfo,
} from '../storage';
import type { MetadataFile, NoteMetadataEntry, NotesStore } from '../types';
import { hasInternalNotePathSegment } from '../utils/fs/internalNotePaths';
import {
  normalizeNotesRootRelativePath,
  resolveNotesRootRelativeFullPath,
} from '../utils/fs/notesRootPathContainment';
import type { FeatureSlice } from './featureSlice';
import {
  hasUnsafeNotePathSegment,
  isMetadataUpdateSourceContentWithinReadLimit
} from './featureSliceContentUtils';
import {
  updateAbsoluteNoteMetadataWithoutRoot,
  updateDraftMetadataWithoutRoot,
} from './featureSliceMetadataNoRootActions';
import { updateNoteMetadataInsideRoot } from './featureSliceMetadataRootActions';

interface CreateFeatureMetadataActionsOptions {
  get: Parameters<StateCreator<NotesStore, [], [], FeatureSlice>>[1];
  isActiveNotesRootRequest: (notesRootPath: string) => boolean;
  set: Parameters<StateCreator<NotesStore, [], [], FeatureSlice>>[0];
}

function replaceNoteEntry(
  metadata: MetadataFile,
  path: string,
  entry: NoteMetadataEntry
): MetadataFile {
  if (Object.keys(entry).length === 0) {
    const { [path]: _, ...rest } = metadata.notes;
    return { ...metadata, notes: rest };
  }

  return {
    ...metadata,
    notes: {
      ...metadata.notes,
      [path]: entry,
    },
  };
}

export function createFeatureMetadataActions({
  get,
  isActiveNotesRootRequest,
  set,
}: CreateFeatureMetadataActionsOptions) {
  const applyCompletedMetadataWrite = (
    path: string,
    content: string,
    modifiedAt: number | null,
    size: number | null,
    optimisticContent = content,
    metadata?: NoteMetadataEntry,
  ) => {
    const latestState = get();
    const latestCurrentNote = latestState.currentNote;
    const isCurrentNote = latestCurrentNote?.path === path;
    const latestContent = isCurrentNote
      ? latestCurrentNote.content
      : latestState.noteContentsCache.get(path)?.content;
    const hasNewerContent =
      latestContent !== undefined &&
      latestContent !== optimisticContent;
    const nextContent = hasNewerContent ? latestContent : content;
    const nextMetadata = metadata
      ? replaceNoteEntry(
        latestState.noteMetadata ?? createEmptyMetadataFile(),
        path,
        mergeNoteMetadataWithFileInfo(metadata, {
          createdAt: metadata.createdAt ?? latestState.noteMetadata?.notes[path]?.createdAt,
          modifiedAt,
        }),
      )
      : latestState.noteMetadata;

    set({
      noteMetadata: nextMetadata,
      noteContentsCache: setCachedNoteContent(
        latestState.noteContentsCache,
        path,
        nextContent,
        modifiedAt,
        hasNewerContent ? { baselineContent: content, size } : { updateBaseline: true, size },
      ),
      currentNote: isCurrentNote
        ? { path, content: nextContent }
        : latestState.currentNote,
      isDirty: isCurrentNote
        ? hasNewerContent
        : latestState.isDirty,
      openTabs: setNoteTabDirtyState(latestState.openTabs, path, hasNewerContent),
      error: null,
    });
  };

  const writeNoteContent = async (
    path: string,
    content: string,
    notesRootPath: string,
  ) => {
    const fullPath = isAbsolutePath(path)
      ? path
      : notesRootPath
        ? (await resolveNotesRootRelativeFullPath(notesRootPath, path)).fullPath
        : null;

    if (!fullPath || !isActiveNotesRootRequest(notesRootPath)) {
      return {
        content,
        modifiedAt: getCachedNoteModifiedAt(get().noteContentsCache, path),
        size: get().noteContentsCache.get(path)?.size ?? null,
        metadata: undefined,
      };
    }

    const result = await saveNoteDocument({
      notesPath: notesRootPath,
      currentNote: { path, content },
      cache: get().noteContentsCache,
    });
    return {
      content: result.content,
      modifiedAt: result.modifiedAt,
      size: result.size,
      metadata: result.metadata,
    };
  };

  const markMetadataWriteFailedDirty = (path: string, error: unknown) => {
    const latestState = get();
    const isCurrentNote = latestState.currentNote?.path === path;
    const tabExists = latestState.openTabs.some((tab) => tab.path === path);

    set({
      error: error instanceof Error ? error.message : 'Failed to update note metadata',
      isDirty: isCurrentNote ? true : latestState.isDirty,
      openTabs: tabExists
        ? setNoteTabDirtyState(latestState.openTabs, path, true)
        : latestState.openTabs,
    });
  };

  const ensureMetadataSourceContentSafe = (content: string): boolean => {
    if (!isMetadataUpdateSourceContentWithinReadLimit(content)) {
      set({ error: 'Note file is too large to update metadata.' });
      return false;
    }

    try {
      assertEditorSafeMarkdownContent(content);
      return true;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Note file is too complex to update metadata.' });
      return false;
    }
  };

  const updateSingleNoteMetadata = async (
    path: string,
    updates: Partial<NoteMetadataEntry>
  ) => {
    const state = get();
    const notesRootPathAtStart = state.notesPath;
    const isDraftMetadataTarget = isDraftNotePath(path);
    if (!isDraftMetadataTarget && !isSupportedMarkdownPath(path)) {
      set({ error: 'Only Markdown files can be opened as notes.' });
      return;
    }
    if (hasInternalNotePathSegment(path) || (notesRootPathAtStart && hasInternalNotePathSegment(notesRootPathAtStart))) {
      set({ error: 'Path must not be inside an internal notes folder.' });
      return;
    }
    if (!isDraftMetadataTarget && hasUnsafeNotePathSegment(path)) {
      set({ error: 'Selected file path contains unsupported characters' });
      return;
    }
    if (!isDraftMetadataTarget && !isAbsolutePath(path) && normalizeNotesRootRelativePath(path) == null) {
      set({ error: 'Path must stay inside the opened folder.' });
      return;
    }

    if (!notesRootPathAtStart) {
      if (isAbsolutePath(path)) {
        await updateAbsoluteNoteMetadataWithoutRoot(
          {
            applyCompletedMetadataWrite,
            ensureMetadataSourceContentSafe,
            get,
            markMetadataWriteFailedDirty,
            replaceNoteEntry,
            set,
            writeNoteContent,
          },
          path,
          updates,
          state,
        );
        return;
      }

      if (isDraftMetadataTarget) {
        updateDraftMetadataWithoutRoot(
          {
            ensureMetadataSourceContentSafe,
            replaceNoteEntry,
            set,
          },
          path,
          updates,
          state,
        );
      }
      return;
    }

    await updateNoteMetadataInsideRoot(
      {
        applyCompletedMetadataWrite,
        ensureMetadataSourceContentSafe,
        get,
        isActiveNotesRootRequest,
        markMetadataWriteFailedDirty,
        replaceNoteEntry,
        set,
        writeNoteContent,
      },
      path,
      updates,
      state,
      notesRootPathAtStart,
      isDraftMetadataTarget,
    );
  };

  const updateManyNoteMetadata = async (
    entries: Array<{ path: string; updates: Partial<NoteMetadataEntry> }>
  ) => {
    for (const entry of entries) {
      await updateSingleNoteMetadata(entry.path, entry.updates);
    }
  };

  return { updateManyNoteMetadata, updateSingleNoteMetadata };
}
