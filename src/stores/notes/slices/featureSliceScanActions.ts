import type { StateCreator } from 'zustand';
import { getStorageAdapter } from '@/lib/storage/adapter';
import { normalizeEditorStateMarkdownDocument } from '@/lib/notes/markdown/markdownSerializationUtils';
import type { NotesStore } from '../types';
import { createCachedNoteContentEntry } from '../document/noteContentCache';
import { hasInternalNotePathSegment } from '../utils/fs/internalNotePaths';
import {
  MAX_SCANNED_NOTE_CONTENT_CHARS,
  MAX_SEARCHABLE_NOTE_BYTES,
  canReadBoundedMarkdownFile,
  canReuseScannedNoteCacheEntry,
  collectNoteContentScanPaths,
  getKnownMarkdownFileSize,
  getKnownMarkdownModifiedAt,
  isSearchableMarkdownContent,
} from './featureSliceContentUtils';
import type { FeatureSlice } from './featureSlice';

interface CreateNoteContentScanActionsOptions {
  get: Parameters<StateCreator<NotesStore, [], [], FeatureSlice>>[1];
  isActiveNotesRootRequest: (notesRootPath: string) => boolean;
  set: Parameters<StateCreator<NotesStore, [], [], FeatureSlice>>[0];
}

export function createNoteContentScanActions({
  get,
  isActiveNotesRootRequest,
  set,
}: CreateNoteContentScanActionsOptions) {
  let noteContentScanController: AbortController | null = null;
  let noteContentScanGeneration = 0;

  const cancelNoteContentScan = () => {
    noteContentScanGeneration += 1;
    noteContentScanController?.abort();
    noteContentScanController = null;
  };

  const scanAllNotes = async (options?: { signal?: AbortSignal }) => {
    cancelNoteContentScan();
    const scanController = new AbortController();
    const scanGeneration = noteContentScanGeneration;
    noteContentScanController = scanController;
    const externalSignal = options?.signal;
    const abortFromExternalSignal = () => scanController.abort();
    if (externalSignal?.aborted) {
      scanController.abort();
    } else {
      externalSignal?.addEventListener('abort', abortFromExternalSignal, { once: true });
    }

    const isScanActive = () =>
      !scanController.signal.aborted &&
      scanGeneration === noteContentScanGeneration &&
      noteContentScanController === scanController;

    const { notesPath, rootFolder, noteContentsCache } = get();
    if (!rootFolder || !notesPath || hasInternalNotePathSegment(notesPath) || !isScanActive()) {
      externalSignal?.removeEventListener('abort', abortFromExternalSignal);
      if (noteContentScanController === scanController) noteContentScanController = null;
      return;
    }

    try {
      const storage = getStorageAdapter();
      const scannedCache: NotesStore['noteContentsCache'] = new Map();
      const filePaths = collectNoteContentScanPaths(rootFolder.children, notesPath, isScanActive);
      if (!isScanActive()) return;

      let scannedContentChars = 0;
      const addScannedEntry = (
        path: string,
        content: string,
        modifiedAt: number | null,
        options: { size?: number | null } = {},
      ) => {
        if (!isSearchableMarkdownContent(content) || scannedContentChars >= MAX_SCANNED_NOTE_CONTENT_CHARS) {
          scannedCache.set(path, createCachedNoteContentEntry('', modifiedAt, options));
          return;
        }

        const nextContent =
          scannedContentChars + content.length <= MAX_SCANNED_NOTE_CONTENT_CHARS
            ? content
            : '';

        scannedContentChars += nextContent.length;
        scannedCache.set(path, createCachedNoteContentEntry(nextContent, modifiedAt, options));
      };

      const BATCH_SIZE = 10;
      for (let i = 0; i < filePaths.length; i += BATCH_SIZE) {
        if (!isScanActive()) return;

        const batch = filePaths.slice(i, i + BATCH_SIZE);
        if (scannedContentChars >= MAX_SCANNED_NOTE_CONTENT_CHARS) {
          batch.forEach(({ path }) => addScannedEntry(path, '', null));
          continue;
        }

        const results = await Promise.allSettled(
          batch.map(async ({ path, fullPath }) => {
            if (!isScanActive()) return { path, content: '', modifiedAt: null, size: null };

            const fileInfo = await storage.stat(fullPath).catch(() => null);
            if (!isScanActive()) return { path, content: '', modifiedAt: null, size: null };
            const modifiedAt = getKnownMarkdownModifiedAt(fileInfo);
            const size = getKnownMarkdownFileSize(fileInfo);
            const cachedEntry = noteContentsCache.get(path);
            if (cachedEntry && canReuseScannedNoteCacheEntry(cachedEntry, fileInfo)) {
              return { path, content: cachedEntry.content, modifiedAt, size };
            }

            if (!canReadBoundedMarkdownFile(fileInfo, MAX_SEARCHABLE_NOTE_BYTES)) {
              return { path, content: '', modifiedAt, size };
            }

            try {
              const rawContent = await storage.readFile(fullPath, MAX_SEARCHABLE_NOTE_BYTES);
              if (!isSearchableMarkdownContent(rawContent)) {
                return { path, content: '', modifiedAt, size };
              }

              const content = normalizeEditorStateMarkdownDocument(rawContent);
              if (!isScanActive()) return { path, content: '', modifiedAt: null, size: null };
              return { path, content, modifiedAt, size };
            } catch {
              return { path, content: '', modifiedAt: null, size: null };
            }
          })
        );

        if (!isScanActive()) return;

        results.forEach((result) => {
          if (result.status === 'fulfilled') {
            addScannedEntry(
              result.value.path,
              result.value.content,
              result.value.modifiedAt,
              { size: result.value.size },
            );
          }
        });
      }

      if (!isActiveNotesRootRequest(notesPath) || !isScanActive()) return;

      const latestState = get();
      const cache = new Map(scannedCache);
      if (latestState.currentNote) {
        const currentEntry = latestState.noteContentsCache.get(latestState.currentNote.path);
        cache.set(
          latestState.currentNote.path,
          createCachedNoteContentEntry(
            latestState.currentNote.content,
            currentEntry?.modifiedAt ?? null,
            currentEntry?.size !== undefined ? { size: currentEntry.size } : {},
          ),
        );
      }
      latestState.openTabs.forEach((tab) => {
        if (tab.path === latestState.currentNote?.path) return;

        const cachedEntry = latestState.noteContentsCache.get(tab.path);
        if (cachedEntry && (tab.isDirty || !cache.has(tab.path))) {
          cache.set(tab.path, cachedEntry);
        }
      });
      Object.keys(latestState.draftNotes).forEach((path) => {
        const cachedEntry = latestState.noteContentsCache.get(path);
        if (cachedEntry) cache.set(path, cachedEntry);
      });

      if (isScanActive()) {
        set({ noteContentsCache: cache });
      }
    } finally {
      externalSignal?.removeEventListener('abort', abortFromExternalSignal);
      if (noteContentScanController === scanController) {
        noteContentScanController = null;
      }
    }
  };

  return { cancelNoteContentScan, scanAllNotes };
}
