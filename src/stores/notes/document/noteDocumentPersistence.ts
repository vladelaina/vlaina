import { getStorageAdapter, isAbsolutePath, joinPath } from '@/lib/storage/adapter';
import {
  loadNoteMetadata,
  saveNoteMetadataOrThrow,
  safeWriteTextFile,
  setNoteEntry,
} from '../storage';
import type { CurrentNoteState, MetadataFile } from '../types';
import {
  getCachedNoteContent,
  setCachedNoteContent,
  type NoteContentCache,
} from './noteContentCache';
import { markExpectedExternalChange } from './externalChangeRegistry';

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
  modifiedAt: number | null;
  nextCache: NoteContentCache;
  updatedMetadata: MetadataFile;
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
    return {
      content: cachedContent,
      modifiedAt: cache.get(path)?.modifiedAt ?? null,
      nextCache: cache,
    };
  }

  const storage = getStorageAdapter();
  const fullPath = await resolveStoredPath(notesPath, path);
  const [content, fileInfo] = await Promise.all([
    storage.readFile(fullPath),
    storage.stat(fullPath),
  ]);
  const modifiedAt = fileInfo?.modifiedAt ?? null;

  return {
    content,
    modifiedAt,
    nextCache: setCachedNoteContent(cache, path, content, modifiedAt),
  };
}

export async function saveNoteDocument({
  notesPath,
  currentNote,
  cache,
}: SaveNoteDocumentOptions): Promise<SavedNoteDocument> {
  const storage = getStorageAdapter();
  const fullPath = await resolveStoredPath(notesPath, currentNote.path);

  markExpectedExternalChange(fullPath);
  await safeWriteTextFile(fullPath, currentNote.content);

  const fileInfo = await storage.stat(fullPath);
  const modifiedAt = fileInfo?.modifiedAt ?? null;
  const metadata = await loadNoteMetadata(notesPath);
  const updatedMetadata = setNoteEntry(metadata, currentNote.path, {
    updatedAt: Date.now(),
  });
  await saveNoteMetadataOrThrow(notesPath, updatedMetadata);

  return {
    modifiedAt,
    nextCache: setCachedNoteContent(cache, currentNote.path, currentNote.content, modifiedAt),
    updatedMetadata,
  };
}
