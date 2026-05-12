import { getStorageAdapter, isAbsolutePath } from '@/lib/storage/adapter';
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
import { resolveVaultRelativeFullPath } from '../utils/fs/vaultPathContainment';
import {
  normalizeSerializedMarkdownDocument,
  summarizeMarkdownNormalizationPipeline,
} from '@/lib/notes/markdown/markdownSerializationUtils';
import {
  compareLineBreakText,
  isNotesDebugLoggingEnabled,
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

const MAX_NOTE_DOCUMENT_BYTES = 10 * 1024 * 1024;
const MAX_NOTE_DOCUMENT_CHARS = 10 * 1024 * 1024;
const MAX_NOTE_DOCUMENT_LINES = 120_000;
const MAX_NOTE_DOCUMENT_LINE_CHARS = 512 * 1024;

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

  return (await resolveVaultRelativeFullPath(notesPath, path)).fullPath;
}

function assertReadableNoteSize(size: number | null | undefined): void {
  if (typeof size === 'number' && size > MAX_NOTE_DOCUMENT_BYTES) {
    throw new Error('Note file is too large to open.');
  }
}

function assertEditorSafeMarkdownContent(content: string): void {
  if (content.length > MAX_NOTE_DOCUMENT_CHARS) {
    throw new Error('Note file is too large to open.');
  }

  let lineCount = content.length === 0 ? 0 : 1;
  let lineLength = 0;
  for (let index = 0; index < content.length; index += 1) {
    const charCode = content.charCodeAt(index);
    if (charCode === 10) {
      lineCount += 1;
      lineLength = 0;
      if (lineCount > MAX_NOTE_DOCUMENT_LINES) {
        throw new Error('Note file is too complex to open safely.');
      }
      continue;
    }

    if (charCode === 13) {
      continue;
    }

    lineLength += 1;
    if (lineLength > MAX_NOTE_DOCUMENT_LINE_CHARS) {
      throw new Error('Note file is too complex to open safely.');
    }
  }
}

export async function loadNoteDocument({
  notesPath,
  path,
  cache,
}: LoadNoteDocumentOptions): Promise<LoadedNoteDocument> {
  const cachedContent = getCachedNoteContent(cache, path);
  if (cachedContent !== undefined) {
    assertEditorSafeMarkdownContent(cachedContent);
    const normalizedCachedContent = normalizeSerializedMarkdownDocument(cachedContent);
    if (isNotesDebugLoggingEnabled()) {
      logNotesDebug('NotesPersistence', 'load:cache-hit', {
        notesPath,
        path,
        cached: summarizeLineBreakText(cachedContent),
        normalized: summarizeLineBreakText(normalizedCachedContent),
        normalizationPipeline: summarizeMarkdownNormalizationPipeline(cachedContent),
        diff: compareLineBreakText(cachedContent, normalizedCachedContent),
        modifiedAt: cache.get(path)?.modifiedAt ?? null,
      });
    }
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
  const fileInfo = await storage.stat(fullPath);
  assertReadableNoteSize(fileInfo?.size ?? null);
  const content = await storage.readFile(fullPath);
  assertEditorSafeMarkdownContent(content);
  const normalizedContent = normalizeSerializedMarkdownDocument(content);
  const modifiedAt = fileInfo?.modifiedAt ?? null;
  if (isNotesDebugLoggingEnabled()) {
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
  }

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
  assertReadableNoteSize(fileInfoBeforeWrite?.size ?? null);
  assertEditorSafeMarkdownContent(currentNote.content);
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
    const cachedContent = getCachedNoteContent(cache, currentNote.path);
    const normalizedCachedContent =
      cachedContent === undefined ? null : normalizeSerializedMarkdownDocument(cachedContent);
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
    if (normalizedCachedContent !== null && normalizedDiskContent === normalizedCachedContent) {
      logNotesDebug('NotesPersistence', 'save:conflict-mtime-only', {
        notesPath,
        notePath: currentNote.path,
        fullPath,
        cachedModifiedAt,
        diskModifiedAt,
        cached: summarizeLineBreakText(normalizedCachedContent),
        input: summarizeLineBreakText(normalizedCurrentContent),
      });
    } else {
      logNotesDebug('NotesPersistence', 'save:conflict', {
        notesPath,
        notePath: currentNote.path,
        fullPath,
        cachedModifiedAt,
        diskModifiedAt,
        disk: summarizeLineBreakText(normalizedDiskContent),
        input: summarizeLineBreakText(normalizedCurrentContent),
        cached: summarizeLineBreakText(normalizedCachedContent),
      });
      throw new NoteWriteConflictError();
    }
  }

  const { content, metadata } = updateNoteMetadataInMarkdown(normalizedCurrentContent, {
    updatedAt: Date.now(),
  });
  if (isNotesDebugLoggingEnabled()) {
    logNotesDebug('NotesPersistence', 'save:prepared-content', {
      notePath: currentNote.path,
      normalized: summarizeLineBreakText(normalizedCurrentContent),
      output: summarizeLineBreakText(content),
      normalizationPipeline: summarizeMarkdownNormalizationPipeline(currentNote.content),
      diffInputToNormalized: compareLineBreakText(currentNote.content, normalizedCurrentContent),
      diffNormalizedToOutput: compareLineBreakText(normalizedCurrentContent, content),
      metadata,
    });
  }

  markExpectedExternalChange(fullPath);
  await safeWriteTextFile(fullPath, content);
  markExpectedExternalChange(fullPath);

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
