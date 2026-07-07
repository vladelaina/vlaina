import type { StoreApi } from 'zustand';
import { getStorageAdapter, isAbsolutePath } from '@/lib/storage/adapter';
import { normalizeEditorStateMarkdownDocument } from '@/lib/notes/markdown/markdownSerializationUtils';
import type { NoteMetadataEntry, NotesStore } from '../types';
import {
  createEmptyMetadataFile,
  mergeNoteMetadataWithFileInfo,
} from '../storage';
import { getCachedNoteModifiedAt, setCachedNoteContent } from '../document/noteContentCache';
import { setNoteTabDirtyState } from '../document/noteTabState';
import { updateNoteMetadataInMarkdown } from '../frontmatter';
import {
  buildSortedRootFolder,
  shouldRebuildRootFolderForMetadataChange,
} from '../utils/fs/rootFolderState';
import { resolveNotesRootRelativeFullPath } from '../utils/fs/notesRootPathContainment';
import {
  MAX_METADATA_UPDATE_NOTE_BYTES,
  canReadBoundedMarkdownFile,
} from './featureSliceContentUtils';

type SetState = StoreApi<NotesStore>['setState'];
type GetState = StoreApi<NotesStore>['getState'];

interface UpdateNoteMetadataInsideRootContext {
  applyCompletedMetadataWrite: (
    path: string,
    content: string,
    modifiedAt: number | null,
    size: number | null,
    optimisticContent: string,
    metadata?: NoteMetadataEntry,
  ) => void;
  ensureMetadataSourceContentSafe: (content: string) => boolean;
  get: GetState;
  isActiveNotesRootRequest: (notesRootPath: string) => boolean;
  markMetadataWriteFailedDirty: (path: string, error: unknown) => void;
  replaceNoteEntry: (metadata: import('../types').MetadataFile, path: string, entry: NoteMetadataEntry) => import('../types').MetadataFile;
  set: SetState;
  writeNoteContent: (
    path: string,
    content: string,
    notesRootPath: string,
  ) => Promise<{
    content: string;
    modifiedAt: number | null;
    size: number | null;
    metadata: NoteMetadataEntry | undefined;
  }>;
}

export async function updateNoteMetadataInsideRoot(
  context: UpdateNoteMetadataInsideRootContext,
  path: string,
  updates: Partial<NoteMetadataEntry>,
  state: NotesStore,
  notesRootPathAtStart: string,
  isDraftMetadataTarget: boolean,
) {
  const {
    applyCompletedMetadataWrite,
    ensureMetadataSourceContentSafe,
    get,
    isActiveNotesRootRequest,
    markMetadataWriteFailedDirty,
    replaceNoteEntry,
    set,
    writeNoteContent,
  } = context;
  let latestState = state;
  let metadataBase = latestState.noteMetadata ?? createEmptyMetadataFile();
  let isCurrentNote = latestState.currentNote?.path === path;
  let sourceContent =
    (isCurrentNote ? latestState.currentNote?.content : undefined) ??
    latestState.noteContentsCache.get(path)?.content;

  if (sourceContent === undefined) {
    let fullPath: string | null = null;
    try {
      fullPath = isAbsolutePath(path)
        ? path
        : (await resolveNotesRootRelativeFullPath(notesRootPathAtStart, path)).fullPath;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to update note metadata' });
      return;
    }

    if (!fullPath) return;

    const storage = getStorageAdapter();
    const fileInfo = await storage.stat(fullPath).catch(() => null);
    if (!canReadBoundedMarkdownFile(fileInfo, MAX_METADATA_UPDATE_NOTE_BYTES)) {
      set({ error: 'Note file is too large to update metadata.' });
      return;
    }
    sourceContent = await storage.readFile(fullPath, MAX_METADATA_UPDATE_NOTE_BYTES);
    if (!isActiveNotesRootRequest(notesRootPathAtStart)) return;
    latestState = get();
    metadataBase = latestState.noteMetadata ?? createEmptyMetadataFile();
    isCurrentNote = latestState.currentNote?.path === path;
    sourceContent =
      (isCurrentNote ? latestState.currentNote?.content : undefined) ??
      latestState.noteContentsCache.get(path)?.content ??
      sourceContent;
  }

  if (!ensureMetadataSourceContentSafe(sourceContent)) return;

  const normalizedSourceContent = normalizeEditorStateMarkdownDocument(sourceContent);
  const cachedModifiedAt = getCachedNoteModifiedAt(latestState.noteContentsCache, path);
  const { content, metadata } = updateNoteMetadataInMarkdown(normalizedSourceContent, updates);
  const isDraftNote = isDraftMetadataTarget;
  const nextMetadataEntry = isDraftNote
    ? metadata
    : mergeNoteMetadataWithFileInfo(metadata, {
        createdAt: metadataBase.notes[path]?.createdAt,
        modifiedAt: cachedModifiedAt ?? metadataBase.notes[path]?.updatedAt,
      });
  const nextMetadata = replaceNoteEntry(metadataBase, path, nextMetadataEntry);
  const shouldRebuildRootFolder = shouldRebuildRootFolderForMetadataChange(
    latestState.fileTreeSortMode,
    metadataBase.notes[path],
    nextMetadata.notes[path],
  );
  const nextRootFolder = shouldRebuildRootFolder
    ? buildSortedRootFolder(
        latestState.rootFolder,
        latestState.rootFolder?.children ?? [],
        latestState.fileTreeSortMode,
        nextMetadata
      )
    : latestState.rootFolder;
  const nextCache = setCachedNoteContent(latestState.noteContentsCache, path, content, cachedModifiedAt);

  if (!isActiveNotesRootRequest(notesRootPathAtStart)) return;

  set({
    noteMetadata: nextMetadata,
    rootFolder: nextRootFolder,
    noteContentsCache: nextCache,
    currentNote: isCurrentNote ? { path, content } : latestState.currentNote,
    isDirty: isCurrentNote && isDraftNote ? true : latestState.isDirty,
    openTabs: isCurrentNote && isDraftNote
      ? setNoteTabDirtyState(latestState.openTabs, path, true)
      : latestState.openTabs,
    error: null,
  });

  if (isDraftNote) {
    const draftNote = latestState.draftNotes[path];
    const canImplicitlySaveDraft =
      Boolean(isCurrentNote && notesRootPathAtStart) &&
      Boolean(draftNote) &&
      (draftNote.originNotesPath === undefined || draftNote.originNotesPath === notesRootPathAtStart);
    if (canImplicitlySaveDraft) {
      await get().saveNote({ explicit: false });
    }
    return;
  }

  const targetTabIsDirty = latestState.openTabs.some((tab) => tab.path === path && tab.isDirty);
  if ((isCurrentNote && latestState.isDirty) || targetTabIsDirty) return;

  try {
    const result = await writeNoteContent(path, content, notesRootPathAtStart);
    if (!isActiveNotesRootRequest(notesRootPathAtStart)) return;
    applyCompletedMetadataWrite(path, result.content, result.modifiedAt, result.size, content, result.metadata ?? metadata);
  } catch (error) {
    markMetadataWriteFailedDirty(path, error);
  }
}
