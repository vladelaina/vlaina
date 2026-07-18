import type { StateCreator } from 'zustand';
import { getStorageAdapter } from '@/lib/storage/adapter';
import { normalizeEditorStateMarkdownDocument } from '@/lib/notes/markdown/markdownSerializationUtils';
import type { NotesStore, ScanAllNotesOptions } from '../types';
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

const NOTE_CONTENT_SCAN_BATCH_SIZE = 32;

function preserveLiveNoteCacheEntries(
  cache: NotesStore['noteContentsCache'],
  state: NotesStore,
) {
  if (state.currentNote) {
    const currentEntry = state.noteContentsCache.get(state.currentNote.path);
    cache.set(
      state.currentNote.path,
      createCachedNoteContentEntry(
        state.currentNote.content,
        currentEntry?.modifiedAt ?? null,
        {
          baselineContent: currentEntry?.savedContent ?? currentEntry?.content,
          ...(currentEntry?.size !== undefined ? { size: currentEntry.size } : {}),
        },
      ),
    );
  }
  state.openTabs.forEach((tab) => {
    if (tab.path === state.currentNote?.path) return;
    const cachedEntry = state.noteContentsCache.get(tab.path);
    if (cachedEntry && (tab.isDirty || !cache.has(tab.path))) {
      cache.set(tab.path, cachedEntry);
    }
  });
  Object.keys(state.draftNotes).forEach((path) => {
    const cachedEntry = state.noteContentsCache.get(path);
    if (cachedEntry) cache.set(path, cachedEntry);
  });
}

interface ScannedNoteContent {
  baselineContent?: string;
  content: string;
  contentLoaded: boolean;
  modifiedAt: number | null;
  path: string;
  size: number | null;
}

export function createNoteContentScanActions({
  get,
  isActiveNotesRootRequest,
  set,
}: CreateNoteContentScanActionsOptions) {
  let noteContentScanController: AbortController | null = null;
  let noteContentScanPromise: Promise<void> | null = null;
  let noteContentScanGeneration = 0;

  const cancelNoteContentScan = () => {
    noteContentScanGeneration += 1;
    noteContentScanController?.abort();
    noteContentScanController = null;
  };

  const runNoteContentScan = async (options?: ScanAllNotesOptions) => {
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
      const priorityPaths = new Set(options?.priorityPaths);
      if (priorityPaths.size > 0) {
        filePaths.sort((left, right) =>
          Number(priorityPaths.has(right.path)) - Number(priorityPaths.has(left.path))
        );
      }
      if (!isScanActive()) return;

      const pendingPriorityPaths = new Set(
        filePaths
          .map(({ path }) => path)
          .filter((path) => priorityPaths.has(path)),
      );
      let priorityPathsPublished = false;

      const publishPriorityPaths = () => {
        if (
          !options?.onPriorityPathsScanned
          || priorityPathsPublished
          || pendingPriorityPaths.size > 0
          || !isActiveNotesRootRequest(notesPath)
          || !isScanActive()
        ) {
          return;
        }
        priorityPathsPublished = true;
        const latestState = get();
        const cache = new Map(latestState.noteContentsCache);
        scannedCache.forEach((entry, path) => cache.set(path, entry));
        preserveLiveNoteCacheEntries(cache, latestState);
        set({ noteContentsCache: cache });
        options?.onPriorityPathsScanned?.();
      };

      const finishBatchPriorityPaths = (batch: Array<{ path: string }>) => {
        batch.forEach(({ path }) => pendingPriorityPaths.delete(path));
        publishPriorityPaths();
      };

      publishPriorityPaths();

      let scannedContentChars = 0;
      const addScannedEntry = (
        path: string,
        content: string,
        contentLoaded: boolean,
        modifiedAt: number | null,
        options: { baselineContent?: string; size?: number | null } = {},
      ) => {
        if (
          !contentLoaded ||
          !isSearchableMarkdownContent(content) ||
          scannedContentChars + content.length > MAX_SCANNED_NOTE_CONTENT_CHARS
        ) {
          return;
        }

        scannedContentChars += content.length;
        scannedCache.set(path, createCachedNoteContentEntry(content, modifiedAt, options));
      };

      for (let i = 0; i < filePaths.length; i += NOTE_CONTENT_SCAN_BATCH_SIZE) {
        if (!isScanActive()) return;

        const batch = filePaths.slice(i, i + NOTE_CONTENT_SCAN_BATCH_SIZE);
        if (scannedContentChars >= MAX_SCANNED_NOTE_CONTENT_CHARS) {
          finishBatchPriorityPaths(batch);
          continue;
        }

        const results = await Promise.allSettled(
          batch.map(async ({ path, fullPath }): Promise<ScannedNoteContent> => {
            if (!isScanActive()) return { path, content: '', contentLoaded: false, modifiedAt: null, size: null };

            const fileInfo = await storage.stat(fullPath).catch(() => null);
            if (!isScanActive()) return { path, content: '', contentLoaded: false, modifiedAt: null, size: null };
            const modifiedAt = getKnownMarkdownModifiedAt(fileInfo);
            const size = getKnownMarkdownFileSize(fileInfo);
            const cachedEntry = noteContentsCache.get(path);
            if (cachedEntry && canReuseScannedNoteCacheEntry(cachedEntry, fileInfo)) {
              return {
                path,
                content: cachedEntry.content,
                contentLoaded: true,
                baselineContent: cachedEntry.savedContent ?? cachedEntry.content,
                modifiedAt,
                size,
              };
            }

            if (!canReadBoundedMarkdownFile(fileInfo, MAX_SEARCHABLE_NOTE_BYTES)) {
              return { path, content: '', contentLoaded: false, modifiedAt, size };
            }

            try {
              const rawContent = await storage.readFile(fullPath, MAX_SEARCHABLE_NOTE_BYTES);
              if (!isSearchableMarkdownContent(rawContent)) {
                return { path, content: '', contentLoaded: false, modifiedAt, size };
              }

              const content = normalizeEditorStateMarkdownDocument(rawContent);
              if (!isScanActive()) return { path, content: '', contentLoaded: false, modifiedAt: null, size: null };
              return { path, content, contentLoaded: true, baselineContent: rawContent, modifiedAt, size };
            } catch {
              return { path, content: '', contentLoaded: false, modifiedAt: null, size: null };
            }
          })
        );

        if (!isScanActive()) return;

        results.forEach((result) => {
          if (result.status === 'fulfilled') {
            addScannedEntry(
              result.value.path,
              result.value.content,
              result.value.contentLoaded,
              result.value.modifiedAt,
              {
                baselineContent: result.value.baselineContent,
                size: result.value.size,
              },
            );
          }
        });
        finishBatchPriorityPaths(batch);
      }

      if (!isActiveNotesRootRequest(notesPath) || !isScanActive()) return;

      const latestState = get();
      const cache = new Map(scannedCache);
      preserveLiveNoteCacheEntries(cache, latestState);

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

  const scanAllNotes = (options?: ScanAllNotesOptions): Promise<void> => {
    if (
      options?.background
      && noteContentScanPromise
      && noteContentScanController
      && !noteContentScanController.signal.aborted
    ) {
      return noteContentScanPromise;
    }
    const promise = runNoteContentScan(options);
    noteContentScanPromise = promise;
    void promise.then(
      () => {
        if (noteContentScanPromise === promise) noteContentScanPromise = null;
      },
      () => {
        if (noteContentScanPromise === promise) noteContentScanPromise = null;
      },
    );
    return promise;
  };

  return { cancelNoteContentScan, scanAllNotes };
}
