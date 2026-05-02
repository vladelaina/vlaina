import { getStorageAdapter, isAbsolutePath, joinPath } from '@/lib/storage/adapter';
import {
  safeWriteTextFile,
} from '../storage';
import type { CurrentNoteState, NoteMetadataEntry } from '../types';
import {
  getCachedNoteContent,
  getCachedNoteModifiedAt,
  setCachedNoteContent,
  type NoteContentCache,
} from './noteContentCache';
import { markExpectedExternalChange } from './externalChangeRegistry';
import { updateNoteMetadataInMarkdown } from '../frontmatter';
import { normalizeSerializedMarkdownDocument } from '@/lib/notes/markdown/markdownSerializationUtils';

interface LoadNoteDocumentOptions {
  notesPath: string;
  path: string;
  cache: NoteContentCache;
}

interface SaveNoteDocumentOptions {
  notesPath: string;
  currentNote: CurrentNoteState;
  cache: NoteContentCache;
}

export interface LoadedNoteDocument {
  content: string;
  modifiedAt: number | null;
  nextCache: NoteContentCache;
}

export interface SavedNoteDocument {
  content: string;
  modifiedAt: number | null;
  nextCache: NoteContentCache;
  metadata: NoteMetadataEntry;
}

export class NoteWriteConflictError extends Error {
  constructor() {
    super('Current note changed on disk. Reload or resolve the conflict before saving.');
    this.name = 'NoteWriteConflictError';
  }
}

async function resolveStoredPath(notesPath: string, path: string): Promise<string> {
  if (isAbsolutePath(path)) {
    return path;
  }

  return joinPath(notesPath, path);
}

export async function loadNoteDocument({
  notesPath,
  path,
  cache,
}: LoadNoteDocumentOptions): Promise<LoadedNoteDocument> {
  const cachedContent = getCachedNoteContent(cache, path);
  if (cachedContent !== undefined) {
    const normalizedCachedContent = normalizeSerializedMarkdownDocument(cachedContent);
    return {
      content: normalizedCachedContent,
      modifiedAt: cache.get(path)?.modifiedAt ?? null,
      nextCache: normalizedCachedContent === cachedContent
        ? cache
        : setCachedNoteContent(cache, path, normalizedCachedContent, cache.get(path)?.modifiedAt ?? null),
    };
  }

  const storage = getStorageAdapter();
  const fullPath = await resolveStoredPath(notesPath, path);
  const [content, fileInfo] = await Promise.all([
    storage.readFile(fullPath),
    storage.stat(fullPath),
  ]);
  const normalizedContent = normalizeSerializedMarkdownDocument(content);
  const modifiedAt = fileInfo?.modifiedAt ?? null;

  return {
    content: normalizedContent,
    modifiedAt,
    nextCache: setCachedNoteContent(cache, path, normalizedContent, modifiedAt),
  };
}

export async function saveNoteDocument({
  notesPath,
  currentNote,
  cache,
}: SaveNoteDocumentOptions): Promise<SavedNoteDocument> {
  const storage = getStorageAdapter();
  const fullPath = await resolveStoredPath(notesPath, currentNote.path);
  const cachedModifiedAt = getCachedNoteModifiedAt(cache, currentNote.path);
  const fileInfoBeforeWrite = await storage.stat(fullPath);
  const diskModifiedAt = fileInfoBeforeWrite?.modifiedAt ?? null;
  if (cachedModifiedAt != null && diskModifiedAt != null && diskModifiedAt !== cachedModifiedAt) {
    throw new NoteWriteConflictError();
  }

  const normalizedCurrentContent = normalizeSerializedMarkdownDocument(currentNote.content);
  const { content, metadata } = updateNoteMetadataInMarkdown(normalizedCurrentContent, {
    updatedAt: Date.now(),
  });

  markExpectedExternalChange(fullPath);
  await safeWriteTextFile(fullPath, content);

  const fileInfo = await storage.stat(fullPath);
  const modifiedAt = fileInfo?.modifiedAt ?? null;

  return {
    content,
    metadata,
    modifiedAt,
    nextCache: setCachedNoteContent(cache, currentNote.path, content, modifiedAt),
  };
}
