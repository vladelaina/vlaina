import { getStorageAdapter } from '@/lib/storage/adapter';
import { normalizeEditorStateMarkdownDocument } from '@/lib/notes/markdown/markdownSerializationUtils';
import type { MetadataFile, NoteMetadataEntry, NotesStore } from '../types';
import {
  createEmptyMetadataFile,
  mergeNoteMetadataWithFileInfo,
} from '../storage';
import { getCachedNoteModifiedAt, setCachedNoteContent } from '../document/noteContentCache';
import { setNoteTabDirtyState } from '../document/noteTabState';
import { updateNoteMetadataInMarkdown } from '../frontmatter';
import {
  MAX_METADATA_UPDATE_NOTE_BYTES,
  canReadBoundedMarkdownFile,
} from './featureSliceContentUtils';

interface MetadataNoRootContext {
  applyCompletedMetadataWrite: (
    path: string,
    content: string,
    modifiedAt: number | null,
    size: number | null,
    optimisticContent: string,
    metadata?: NoteMetadataEntry,
  ) => void;
  ensureMetadataSourceContentSafe: (content: string) => boolean;
  get: () => NotesStore;
  markMetadataWriteFailedDirty: (path: string, error: unknown) => void;
  replaceNoteEntry: (metadata: MetadataFile, path: string, entry: NoteMetadataEntry) => MetadataFile;
  set: (partial: Partial<NotesStore>) => void;
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

export async function updateAbsoluteNoteMetadataWithoutRoot(
  context: MetadataNoRootContext,
  path: string,
  updates: Partial<NoteMetadataEntry>,
  state: NotesStore,
) {
  const { applyCompletedMetadataWrite, ensureMetadataSourceContentSafe, get, markMetadataWriteFailedDirty, replaceNoteEntry, set, writeNoteContent } = context;
  let latestState = state;
  let metadataBase = latestState.noteMetadata ?? createEmptyMetadataFile();
  let isCurrentNote = latestState.currentNote?.path === path;
  let sourceContent =
    (isCurrentNote ? latestState.currentNote?.content : undefined) ??
    latestState.noteContentsCache.get(path)?.content;

  if (sourceContent === undefined) {
    const storage = getStorageAdapter();
    const fileInfo = await storage.stat(path).catch(() => null);
    if (!canReadBoundedMarkdownFile(fileInfo, MAX_METADATA_UPDATE_NOTE_BYTES)) {
      set({ error: 'Note file is too large to update metadata.' });
      return;
    }
    sourceContent = await storage.readFile(path, MAX_METADATA_UPDATE_NOTE_BYTES);
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
  const nextMetadata = replaceNoteEntry(
    metadataBase,
    path,
    mergeNoteMetadataWithFileInfo(metadata, {
      createdAt: metadataBase.notes[path]?.createdAt,
      modifiedAt: cachedModifiedAt ?? metadataBase.notes[path]?.updatedAt,
    }),
  );
  const nextCache = setCachedNoteContent(latestState.noteContentsCache, path, content, cachedModifiedAt);

  set({
    noteMetadata: nextMetadata,
    noteContentsCache: nextCache,
    currentNote: isCurrentNote ? { path, content } : latestState.currentNote,
    error: null,
  });

  const targetTabIsDirty = latestState.openTabs.some((tab) => tab.path === path && tab.isDirty);
  if ((isCurrentNote && latestState.isDirty) || targetTabIsDirty) return;

  try {
    const result = await writeNoteContent(path, content, '');
    applyCompletedMetadataWrite(path, result.content, result.modifiedAt, result.size, content, result.metadata ?? metadata);
  } catch (error) {
    markMetadataWriteFailedDirty(path, error);
  }
}

export function updateDraftMetadataWithoutRoot(
  context: Pick<MetadataNoRootContext, 'ensureMetadataSourceContentSafe' | 'replaceNoteEntry' | 'set'>,
  path: string,
  updates: Partial<NoteMetadataEntry>,
  state: NotesStore,
) {
  const { ensureMetadataSourceContentSafe, replaceNoteEntry, set } = context;
  const metadataBase = state.noteMetadata ?? createEmptyMetadataFile();
  const sourceContent =
    (state.currentNote?.path === path ? state.currentNote?.content : undefined) ??
    state.noteContentsCache.get(path)?.content ??
    '';
  if (!ensureMetadataSourceContentSafe(sourceContent)) return;

  const normalizedSourceContent = normalizeEditorStateMarkdownDocument(sourceContent);
  const { content, metadata } = updateNoteMetadataInMarkdown(normalizedSourceContent, updates);
  const nextMetadata = replaceNoteEntry(metadataBase, path, metadata);
  const cachedModifiedAt = getCachedNoteModifiedAt(state.noteContentsCache, path);

  set({
    noteMetadata: nextMetadata,
    noteContentsCache: setCachedNoteContent(state.noteContentsCache, path, content, cachedModifiedAt),
    currentNote: state.currentNote?.path === path ? { path, content } : state.currentNote,
    isDirty: state.currentNote?.path === path ? true : state.isDirty,
    openTabs: state.currentNote?.path === path
      ? setNoteTabDirtyState(state.openTabs, path, true)
      : state.openTabs,
    error: null,
  });
}
