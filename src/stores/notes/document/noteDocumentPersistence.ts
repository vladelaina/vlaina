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
import { readNoteMetadataFromMarkdown, updateNoteMetadataInMarkdown } from '../frontmatter';
import {
  normalizeSerializedMarkdownDocument,
  summarizeMarkdownNormalizationPipeline,
} from '@/lib/notes/markdown/markdownSerializationUtils';
import {
  compareLineBreakText,
  logNotesDebug,
  summarizeLineBreakText,
} from '../lineBreakDebugLog';

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
    logNotesDebug('NotesPersistence', 'load:cache-hit', {
      notesPath,
      path,
      cached: summarizeLineBreakText(cachedContent),
      normalized: summarizeLineBreakText(normalizedCachedContent),
      normalizationPipeline: summarizeMarkdownNormalizationPipeline(cachedContent),
      diff: compareLineBreakText(cachedContent, normalizedCachedContent),
      modifiedAt: cache.get(path)?.modifiedAt ?? null,
    });
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
  logNotesDebug('NotesPersistence', 'load:disk-read', {
    notesPath,
    path,
    fullPath,
    disk: summarizeLineBreakText(content),
    normalized: summarizeLineBreakText(normalizedContent),
    normalizationPipeline: summarizeMarkdownNormalizationPipeline(content),
    diff: compareLineBreakText(content, normalizedContent),
    modifiedAt,
  });

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
  logNotesDebug('NotesPersistence', 'save:start', {
    notesPath,
    notePath: currentNote.path,
    fullPath,
    cachedModifiedAt,
    diskModifiedAt,
    input: summarizeLineBreakText(currentNote.content),
  });
  const normalizedCurrentContent = normalizeSerializedMarkdownDocument(currentNote.content);
  if (cachedModifiedAt != null && diskModifiedAt != null && diskModifiedAt !== cachedModifiedAt) {
    const diskContent = await storage.readFile(fullPath);
    const normalizedDiskContent = normalizeSerializedMarkdownDocument(diskContent);
    if (normalizedDiskContent === normalizedCurrentContent) {
      const metadata = readNoteMetadataFromMarkdown(normalizedDiskContent);
      logNotesDebug('NotesPersistence', 'save:conflict-already-current', {
        notesPath,
        notePath: currentNote.path,
        fullPath,
        cachedModifiedAt,
        diskModifiedAt,
        disk: summarizeLineBreakText(normalizedDiskContent),
      });
      return {
        content: normalizedDiskContent,
        metadata,
        modifiedAt: diskModifiedAt,
        nextCache: setCachedNoteContent(cache, currentNote.path, normalizedDiskContent, diskModifiedAt),
      };
    }
    logNotesDebug('NotesPersistence', 'save:conflict', {
      notesPath,
      notePath: currentNote.path,
      fullPath,
      cachedModifiedAt,
      diskModifiedAt,
      disk: summarizeLineBreakText(normalizedDiskContent),
      input: summarizeLineBreakText(normalizedCurrentContent),
    });
    throw new NoteWriteConflictError();
  }

  const { content, metadata } = updateNoteMetadataInMarkdown(normalizedCurrentContent, {
    updatedAt: Date.now(),
  });
  logNotesDebug('NotesPersistence', 'save:prepared-content', {
    notePath: currentNote.path,
    normalized: summarizeLineBreakText(normalizedCurrentContent),
    output: summarizeLineBreakText(content),
    normalizationPipeline: summarizeMarkdownNormalizationPipeline(currentNote.content),
    diffInputToNormalized: compareLineBreakText(currentNote.content, normalizedCurrentContent),
    diffNormalizedToOutput: compareLineBreakText(normalizedCurrentContent, content),
    metadata,
  });

  markExpectedExternalChange(fullPath);
  await safeWriteTextFile(fullPath, content);

  const fileInfo = await storage.stat(fullPath);
  const modifiedAt = fileInfo?.modifiedAt ?? null;
  logNotesDebug('NotesPersistence', 'save:written', {
    notesPath,
    notePath: currentNote.path,
    fullPath,
    content: summarizeLineBreakText(content),
    modifiedAt,
  });

  return {
    content,
    metadata,
    modifiedAt,
    nextCache: setCachedNoteContent(cache, currentNote.path, content, modifiedAt),
  };
}
