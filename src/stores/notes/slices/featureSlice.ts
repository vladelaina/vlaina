import { StateCreator } from 'zustand';
import { getStorageAdapter, isAbsolutePath } from '@/lib/storage/adapter';
import { joinPath as joinLocalPath } from '@/lib/storage/adapter/pathUtils';
import { getNoteTitleFromPath } from '@/lib/notes/displayName';
import { isSupportedMarkdownPath } from '@/lib/notes/markdownFile';
import { NotesStore, FileTreeNode, MetadataFile, NoteContentCacheEntry, NoteCoverMetadata, NoteMetadataEntry } from '../types';
import {
  createEmptyMetadataFile,
  loadGlobalNoteIconSize,
  loadRecentNotes,
  loadNoteMetadata,
  persistGlobalNoteIconSize,
} from '../storage';
import {
  findStarredEntryByPath,
  loadStarredForVault,
  removeStarredEntryById,
  toggleStarredEntry,
} from '../starred';
import {
  createCachedNoteContentEntry,
  getCachedNoteModifiedAt,
  pruneCachedNoteContents,
  setCachedNoteContent,
} from '../document/noteContentCache';
import { setNoteTabDirtyState } from '../document/noteTabState';
import { isDraftNotePath } from '../draftNote';
import {
  assertEditorSafeMarkdownContent,
  saveNoteDocument,
} from '../document/noteDocumentPersistence';
import { updateNoteMetadataInMarkdown } from '../frontmatter';
import { buildSortedRootFolder } from '../utils/fs/rootFolderState';
import { hasInternalNotePathSegment } from '../utils/fs/internalNotePaths';
import {
  hasUnsafeVaultPathSegment,
  normalizeVaultRelativePath,
  resolveVaultRelativeFullPath,
} from '../utils/fs/vaultPathContainment';
import { normalizeSerializedMarkdownDocument } from '@/lib/notes/markdown/markdownSerializationUtils';
import {
  extractNoteTags,
  getNoteMarkdownExcludedRanges,
  isNoteMarkdownIndexExcluded,
} from '@/lib/notes/tags';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const MAX_SEARCHABLE_NOTE_BYTES = 512 * 1024;
const MAX_SCANNED_NOTE_CONTENT_CHARS = 8 * 1024 * 1024;
const MAX_METADATA_UPDATE_NOTE_BYTES = 10 * 1024 * 1024;
const MAX_NOTE_CONTENT_SCAN_PATHS = 5000;
const MAX_NOTE_CONTENT_SCAN_TREE_NODES = 20_000;
const ICON_SYMBOL_SCHEME_PATTERN = /^icon:/i;
const searchableNoteUtf8Encoder = new TextEncoder();

function canReadBoundedMarkdownFile(
  fileInfo: { isFile?: boolean; isDirectory?: boolean; size?: number | null } | null | undefined,
  maxBytes: number,
): boolean {
  if (!fileInfo || fileInfo.isDirectory === true || fileInfo.isFile === false) {
    return false;
  }

  if (typeof fileInfo.size !== 'number') {
    return true;
  }

  return (
    Number.isFinite(fileInfo.size) &&
    fileInfo.size >= 0 &&
    fileInfo.size <= maxBytes
  );
}

function getKnownMarkdownFileSize(
  fileInfo: { size?: number | null } | null | undefined,
): number | null {
  return typeof fileInfo?.size === 'number' &&
    Number.isFinite(fileInfo.size) &&
    fileInfo.size >= 0
    ? fileInfo.size
    : null;
}

function getKnownMarkdownModifiedAt(
  fileInfo: { modifiedAt?: number | null } | null | undefined,
): number | null {
  return typeof fileInfo?.modifiedAt === 'number' && Number.isFinite(fileInfo.modifiedAt)
    ? fileInfo.modifiedAt
    : null;
}

function hasUnsafeNotePathSegment(path: string): boolean {
  return hasUnsafeVaultPathSegment(path, {
    allowNavigationSegments: true,
  });
}

function isSafeStoredNotePath(path: string): boolean {
  if (hasInternalNotePathSegment(path) || hasUnsafeNotePathSegment(path)) {
    return false;
  }

  return isAbsolutePath(path) || normalizeVaultRelativePath(path) != null;
}

function isSearchableMarkdownContent(content: string): boolean {
  if (content.length > MAX_SEARCHABLE_NOTE_BYTES) {
    return false;
  }
  if (searchableNoteUtf8Encoder.encode(content).length > MAX_SEARCHABLE_NOTE_BYTES) {
    return false;
  }

  try {
    assertEditorSafeMarkdownContent(content);
    return true;
  } catch {
    return false;
  }
}

function getNoteContentScanNodePriority(node: FileTreeNode): number {
  const normalizedPath = normalizeVaultRelativePath(node.path, { allowEmpty: node.isFolder });
  if (!normalizedPath || hasInternalNotePathSegment(normalizedPath)) {
    return 3;
  }

  if (!node.isFolder && isSupportedMarkdownPath(normalizedPath)) {
    return 0;
  }

  return node.isFolder ? 1 : 2;
}

function prioritizeNoteContentScanNodes(nodes: readonly FileTreeNode[]): FileTreeNode[] {
  const priorityBuckets: FileTreeNode[][] = [[], [], [], []];
  for (const node of nodes) {
    priorityBuckets[getNoteContentScanNodePriority(node)]?.push(node);
  }
  return priorityBuckets.flat();
}

function canReuseScannedNoteCacheEntry(
  cachedEntry: NoteContentCacheEntry,
  fileInfo: { isFile?: boolean; isDirectory?: boolean; modifiedAt?: number | null; size?: number | null } | null | undefined,
): boolean {
  if (!canReadBoundedMarkdownFile(fileInfo, MAX_SEARCHABLE_NOTE_BYTES)) {
    return false;
  }

  const modifiedAt = getKnownMarkdownModifiedAt(fileInfo);
  const size = getKnownMarkdownFileSize(fileInfo);
  if (modifiedAt === null) {
    return false;
  }

  if (cachedEntry.modifiedAt !== modifiedAt) {
    return false;
  }

  if (cachedEntry.size !== undefined) {
    return cachedEntry.size === size;
  }

  return size === null;
}

function collectNoteContentScanPaths(
  nodes: readonly FileTreeNode[],
  notesPath: string,
  isScanActive: () => boolean,
): { path: string; fullPath: string }[] {
  const filePaths: { path: string; fullPath: string }[] = [];
  const stack = prioritizeNoteContentScanNodes(nodes).reverse();
  let visitedNodes = 0;

  while (
    stack.length > 0 &&
    filePaths.length < MAX_NOTE_CONTENT_SCAN_PATHS &&
    visitedNodes < MAX_NOTE_CONTENT_SCAN_TREE_NODES
  ) {
    if (!isScanActive()) {
      return filePaths;
    }

    const node = stack.pop()!;
    visitedNodes += 1;
    if (node.isFolder) {
      const folderPath = normalizeVaultRelativePath(node.path, { allowEmpty: true });
      if (folderPath === null || hasInternalNotePathSegment(folderPath)) {
        continue;
      }

      const prioritizedChildren = prioritizeNoteContentScanNodes(node.children);
      for (let index = prioritizedChildren.length - 1; index >= 0; index -= 1) {
        stack.push(prioritizedChildren[index]);
      }
      continue;
    }

    const relativePath = normalizeVaultRelativePath(node.path);
    if (
      relativePath &&
      !hasInternalNotePathSegment(relativePath) &&
      isSupportedMarkdownPath(relativePath)
    ) {
      filePaths.push({
        path: relativePath,
        fullPath: joinLocalPath(notesPath, relativePath),
      });
    }
  }

  return filePaths;
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

export interface FeatureSlice {
  recentNotes: NotesStore['recentNotes'];
  noteContentsCache: NotesStore['noteContentsCache'];
  noteContentsCacheRevision: NotesStore['noteContentsCacheRevision'];
  starredEntries: NotesStore['starredEntries'];
  starredNotes: NotesStore['starredNotes'];
  starredFolders: NotesStore['starredFolders'];
  starredLoaded: NotesStore['starredLoaded'];
  pendingStarredNavigation: NotesStore['pendingStarredNavigation'];
  noteMetadata: MetadataFile | null;
  noteIconSize: number;

  loadStarred: (vaultPath: string) => Promise<void>;
  loadMetadata: (vaultPath: string) => Promise<void>;
  scanAllNotes: (options?: { signal?: AbortSignal }) => Promise<void>;
  cancelNoteContentScan: () => void;
  pruneNoteContentsCacheToOpenNotes: () => void;
  getBacklinks: (notePath: string) => { path: string; name: string; context: string }[];
  getAllTags: () => { tag: string; count: number }[];
  toggleStarred: (path: string) => void;
  toggleFolderStarred: (path: string) => void;
  removeStarredEntry: (id: string) => void;
  isStarred: (path: string) => boolean;
  isFolderStarred: (path: string) => boolean;
  setPendingStarredNavigation: (navigation: NotesStore['pendingStarredNavigation']) => void;
  getNoteIcon: (path: string) => string | undefined;
  setNoteIcon: (path: string, emoji: string | null) => void;
  updateAllIconColors: (newColor: string) => void;
  updateAllEmojiSkinTones: (newTone: number) => Promise<void>;
  getNoteCover: (path: string) => NoteCoverMetadata | undefined;
  setNoteCover: (path: string, cover: NoteCoverMetadata | null) => void;
  getNoteIconSize: (path: string) => number | undefined;
  setNoteIconSize: (path: string, size: number) => void;
  setGlobalIconSize: (size: number) => void;
}

export const createFeatureSlice: StateCreator<NotesStore, [], [], FeatureSlice> = (set, get) => {
  const isActiveVaultRequest = (vaultPath: string) => get().notesPath === vaultPath;
  let noteContentScanController: AbortController | null = null;
  let noteContentScanGeneration = 0;

  const abortActiveNoteContentScan = () => {
    noteContentScanGeneration += 1;
    noteContentScanController?.abort();
    noteContentScanController = null;
  };

  const applyCompletedMetadataWrite = (
    path: string,
    content: string,
    modifiedAt: number | null,
    size: number | null,
    optimisticContent = content,
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

    set({
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
    vaultPath: string,
    updatedAt: number,
  ) => {
    const fullPath = isAbsolutePath(path)
      ? path
      : vaultPath
        ? (await resolveVaultRelativeFullPath(vaultPath, path)).fullPath
        : null;

    if (!fullPath || !isActiveVaultRequest(vaultPath)) {
      return {
        content,
        modifiedAt: getCachedNoteModifiedAt(get().noteContentsCache, path),
        size: get().noteContentsCache.get(path)?.size ?? null,
      };
    }

    const result = await saveNoteDocument({
      notesPath: vaultPath,
      currentNote: { path, content },
      cache: get().noteContentsCache,
      updatedAt,
    });
    return {
      content: result.content,
      modifiedAt: result.modifiedAt,
      size: result.size,
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
    const vaultPathAtStart = state.notesPath;
    const isDraftMetadataTarget = isDraftNotePath(path);
    if (!isDraftMetadataTarget && !isSupportedMarkdownPath(path)) {
      set({ error: 'Only Markdown files can be opened as notes.' });
      return;
    }
    if (hasInternalNotePathSegment(path) || (vaultPathAtStart && hasInternalNotePathSegment(vaultPathAtStart))) {
      set({ error: 'Path must not be inside an internal notes folder.' });
      return;
    }
    if (!isDraftMetadataTarget && hasUnsafeNotePathSegment(path)) {
      set({ error: 'Selected file path contains unsupported characters' });
      return;
    }
    if (!isDraftMetadataTarget && !isAbsolutePath(path) && normalizeVaultRelativePath(path) == null) {
      set({ error: 'Path must stay inside the current vault.' });
      return;
    }

    if (!vaultPathAtStart) {
      if (isAbsolutePath(path)) {
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

        if (!ensureMetadataSourceContentSafe(sourceContent)) {
          return;
        }

        const normalizedSourceContent = normalizeSerializedMarkdownDocument(sourceContent);
        const metadataUpdatedAt = Date.now();
        const { content, metadata } = updateNoteMetadataInMarkdown(normalizedSourceContent, {
          ...updates,
          updatedAt: metadataUpdatedAt,
        });
        const nextMetadata = replaceNoteEntry(metadataBase, path, metadata);
        const cachedModifiedAt = getCachedNoteModifiedAt(latestState.noteContentsCache, path);
        const nextCache = setCachedNoteContent(latestState.noteContentsCache, path, content, cachedModifiedAt);

        set({
          noteMetadata: nextMetadata,
          noteContentsCache: nextCache,
          currentNote: isCurrentNote ? { path, content } : latestState.currentNote,
          error: null,
        });

        const targetTabIsDirty = latestState.openTabs.some((tab) => tab.path === path && tab.isDirty);
        if ((isCurrentNote && latestState.isDirty) || targetTabIsDirty) {
          return;
        }

        try {
          const result = await writeNoteContent(path, content, '', metadataUpdatedAt);
          applyCompletedMetadataWrite(path, result.content, result.modifiedAt, result.size, content);
        } catch (error) {
          markMetadataWriteFailedDirty(path, error);
        }
        return;
      }

      if (isDraftMetadataTarget) {
        const metadataBase = state.noteMetadata ?? createEmptyMetadataFile();
        const sourceContent =
          (state.currentNote?.path === path ? state.currentNote?.content : undefined) ??
          state.noteContentsCache.get(path)?.content ??
          '';
        if (!ensureMetadataSourceContentSafe(sourceContent)) {
          return;
        }

        const normalizedSourceContent = normalizeSerializedMarkdownDocument(sourceContent);
        const { content, metadata } = updateNoteMetadataInMarkdown(normalizedSourceContent, {
          ...updates,
          updatedAt: Date.now(),
        });
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

        return;
      }
      return;
    }

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
          : vaultPathAtStart
            ? (await resolveVaultRelativeFullPath(vaultPathAtStart, path)).fullPath
            : null;
      } catch (error) {
        set({ error: error instanceof Error ? error.message : 'Failed to update note metadata' });
        return;
      }

      if (!fullPath) {
        return;
      }

      const storage = getStorageAdapter();
      const fileInfo = await storage.stat(fullPath).catch(() => null);
      if (!canReadBoundedMarkdownFile(fileInfo, MAX_METADATA_UPDATE_NOTE_BYTES)) {
        set({ error: 'Note file is too large to update metadata.' });
        return;
      }
      sourceContent = await storage.readFile(fullPath, MAX_METADATA_UPDATE_NOTE_BYTES);
      if (!isActiveVaultRequest(vaultPathAtStart)) {
        return;
      }
      latestState = get();
      metadataBase = latestState.noteMetadata ?? createEmptyMetadataFile();
      isCurrentNote = latestState.currentNote?.path === path;
      sourceContent =
        (isCurrentNote ? latestState.currentNote?.content : undefined) ??
        latestState.noteContentsCache.get(path)?.content ??
        sourceContent;
    }

    if (!ensureMetadataSourceContentSafe(sourceContent)) {
      return;
    }

    const normalizedSourceContent = normalizeSerializedMarkdownDocument(sourceContent);
    const metadataUpdatedAt = Date.now();
    const { content, metadata } = updateNoteMetadataInMarkdown(normalizedSourceContent, {
      ...updates,
      updatedAt: metadataUpdatedAt,
    });
    const nextMetadata = replaceNoteEntry(metadataBase, path, metadata);
    const isDraftNote = isDraftMetadataTarget;
    const nextRootFolder = buildSortedRootFolder(
      latestState.rootFolder,
      latestState.rootFolder?.children ?? [],
      latestState.fileTreeSortMode,
      nextMetadata
    );
    const cachedModifiedAt = getCachedNoteModifiedAt(latestState.noteContentsCache, path);
    const nextCache = setCachedNoteContent(latestState.noteContentsCache, path, content, cachedModifiedAt);

    if (!isActiveVaultRequest(vaultPathAtStart)) {
      return;
    }

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
        Boolean(isCurrentNote && vaultPathAtStart) &&
        Boolean(draftNote) &&
        (draftNote.originNotesPath === undefined || draftNote.originNotesPath === vaultPathAtStart);
      if (canImplicitlySaveDraft) {
        await get().saveNote({ explicit: false });
      }
      return;
    }

    const targetTabIsDirty = latestState.openTabs.some((tab) => tab.path === path && tab.isDirty);
    if ((isCurrentNote && latestState.isDirty) || targetTabIsDirty) {
      return;
    }

    try {
      const result = await writeNoteContent(path, content, vaultPathAtStart, metadataUpdatedAt);
      if (!isActiveVaultRequest(vaultPathAtStart)) {
        return;
      }
      applyCompletedMetadataWrite(path, result.content, result.modifiedAt, result.size, content);
    } catch (error) {
      markMetadataWriteFailedDirty(path, error);
    }
  };

  const updateManyNoteMetadata = async (
    entries: Array<{ path: string; updates: Partial<NoteMetadataEntry> }>
  ) => {
    for (const entry of entries) {
      await updateSingleNoteMetadata(entry.path, entry.updates);
    }
  };

  return {
    recentNotes: loadRecentNotes(),
    noteContentsCache: new Map(),
    noteContentsCacheRevision: 0,
    starredEntries: [],
    starredNotes: [],
    starredFolders: [],
    starredLoaded: false,
    pendingStarredNavigation: null,
    noteMetadata: null,
    noteIconSize: loadGlobalNoteIconSize(),

    loadStarred: async (vaultPath: string) => {
      await loadStarredForVault(set, get, vaultPath);
    },

    loadMetadata: async (vaultPath: string) => {
      const metadata = await loadNoteMetadata(vaultPath);
      if (!isActiveVaultRequest(vaultPath)) {
        return;
      }
      set({
        noteMetadata: metadata,
      });
    },

    scanAllNotes: async (options?: { signal?: AbortSignal }) => {
      abortActiveNoteContentScan();
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
        if (noteContentScanController === scanController) {
          noteContentScanController = null;
        }
        return;
      }

      try {
        const storage = getStorageAdapter();
        const scannedCache: NotesStore['noteContentsCache'] = new Map();
        const filePaths = collectNoteContentScanPaths(rootFolder.children, notesPath, isScanActive);
        if (!isScanActive()) {
          return;
        }

        let scannedContentChars = 0;
        const addScannedEntry = (
          path: string,
          content: string,
          modifiedAt: number | null,
          options: { size?: number | null } = {},
        ) => {
          if (!isSearchableMarkdownContent(content)) {
            scannedCache.set(path, createCachedNoteContentEntry('', modifiedAt, options));
            return;
          }

          if (scannedContentChars >= MAX_SCANNED_NOTE_CONTENT_CHARS) {
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
          if (!isScanActive()) {
            return;
          }

          const batch = filePaths.slice(i, i + BATCH_SIZE);
          if (scannedContentChars >= MAX_SCANNED_NOTE_CONTENT_CHARS) {
            batch.forEach(({ path }) => addScannedEntry(path, '', null));
            continue;
          }

          const results = await Promise.allSettled(
            batch.map(async ({ path, fullPath }) => {
              if (!isScanActive()) {
                return { path, content: '', modifiedAt: null, size: null };
              }

              let modifiedAt: number | null = null;
              let size: number | null = null;
              const fileInfo = await storage.stat(fullPath).catch(() => null);
              if (!isScanActive()) {
                return { path, content: '', modifiedAt: null, size: null };
              }
              modifiedAt = getKnownMarkdownModifiedAt(fileInfo);
              size = getKnownMarkdownFileSize(fileInfo);
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

                const content = normalizeSerializedMarkdownDocument(rawContent);
                if (!isScanActive()) {
                  return { path, content: '', modifiedAt: null, size: null };
                }
                return { path, content, modifiedAt, size };
              } catch {
                return { path, content: '', modifiedAt: null, size: null };
              }
            })
          );

          if (!isScanActive()) {
            return;
          }

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

        if (!isActiveVaultRequest(notesPath) || !isScanActive()) {
          return;
        }

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
          if (tab.path === latestState.currentNote?.path) {
            return;
          }

          const cachedEntry = latestState.noteContentsCache.get(tab.path);
          if (cachedEntry) {
            if (tab.isDirty || !cache.has(tab.path)) {
              cache.set(tab.path, cachedEntry);
            }
          }
        });
        Object.keys(latestState.draftNotes).forEach((path) => {
          const cachedEntry = latestState.noteContentsCache.get(path);
          if (cachedEntry) {
            cache.set(path, cachedEntry);
          }
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
    },

    cancelNoteContentScan: () => {
      abortActiveNoteContentScan();
    },

    pruneNoteContentsCacheToOpenNotes: () => {
      const { currentNote, openTabs, draftNotes, noteContentsCache } = get();
      const keepPaths = new Set(openTabs.map((tab) => tab.path));
      if (currentNote) {
        keepPaths.add(currentNote.path);
      }
      Object.keys(draftNotes).forEach((path) => keepPaths.add(path));

      const nextCache = pruneCachedNoteContents(
        noteContentsCache,
        (path) => !keepPaths.has(path),
      );
      if (nextCache !== noteContentsCache) {
        set({ noteContentsCache: nextCache });
      }
    },

    getBacklinks: (notePath: string) => {
      if (hasInternalNotePathSegment(notePath)) {
        return [];
      }

      const { noteContentsCache } = get();
      const results: { path: string; name: string; context: string }[] = [];
      const noteName = getNoteTitleFromPath(notePath).toLowerCase();
      const escapedNoteName = escapeRegExp(noteName);

      const patterns = [
        new RegExp(`\\[\\[${escapedNoteName}\\]\\]`, 'gi'),
        new RegExp(`\\[\\[${escapedNoteName}\\|[^\\]]+\\]\\]`, 'gi'),
      ];

      noteContentsCache.forEach((entry, path) => {
        if (!isSafeStoredNotePath(path)) {
          return;
        }

        const content = entry.content;
        if (path === notePath || !content.includes('[[')) return;
        const excludedRanges = getNoteMarkdownExcludedRanges(content);

        for (const pattern of patterns) {
          let excludedRangeCursor = 0;
          pattern.lastIndex = 0;
          let match: RegExpExecArray | null;
          while ((match = pattern.exec(content)) !== null) {
            while (
              excludedRangeCursor < excludedRanges.length &&
              excludedRanges[excludedRangeCursor].to <= match.index
            ) {
              excludedRangeCursor += 1;
            }
            if (isNoteMarkdownIndexExcluded(match.index, excludedRanges, excludedRangeCursor)) {
              continue;
            }

            break;
          }
          if (match) {
            const index = match.index;
            const start = Math.max(0, index - 50);
            const end = Math.min(content.length, index + match[0].length + 50);
            let context = content.substring(start, end).replace(/\n/g, ' ').trim();
            if (start > 0) context = '...' + context;
            if (end < content.length) context = context + '...';

            const fileName = getNoteTitleFromPath(path);
            results.push({ path, name: fileName, context });
            break;
          }
        }
      });

      return results;
    },

    getAllTags: () => {
      const { noteContentsCache } = get();
      const tagCounts = new Map<string, number>();

      noteContentsCache.forEach((entry, path) => {
        if (!isSafeStoredNotePath(path)) {
          return;
        }

        for (const tag of extractNoteTags(entry.content)) {
          tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
        }
      });

      return Array.from(tagCounts.entries())
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count);
    },

    toggleStarred: (path: string) => {
      toggleStarredEntry(set, get, 'note', path);
    },

    toggleFolderStarred: (path: string) => {
      toggleStarredEntry(set, get, 'folder', path);
    },

    removeStarredEntry: (id: string) => {
      removeStarredEntryById(set, get, id);
    },

    isStarred: (path: string) => {
      const { notesPath, starredEntries } = get();
      return Boolean(findStarredEntryByPath(starredEntries, 'note', path, notesPath));
    },

    isFolderStarred: (path: string) => {
      const { notesPath, starredEntries } = get();
      return Boolean(findStarredEntryByPath(starredEntries, 'folder', path, notesPath));
    },

    setPendingStarredNavigation: (pendingStarredNavigation) => set({ pendingStarredNavigation }),

    getNoteIcon: (path: string) => {
      const { noteMetadata } = get();
      if (!noteMetadata) return undefined;
      return noteMetadata.notes[path]?.icon;
    },

    setNoteIcon: (path: string, emoji: string | null) => {
      void Promise.resolve(updateSingleNoteMetadata(path, { icon: emoji ?? undefined }))
        .catch(() => undefined);
    },

    updateAllIconColors: (newColor: string) => {
      const { noteMetadata } = get();
      if (!noteMetadata) return;

      const updates = Object.entries(noteMetadata.notes)
        .map(([path, entry]) => {
          if (hasInternalNotePathSegment(path)) {
            return null;
          }
          if (!isSafeStoredNotePath(path)) {
            return null;
          }

          if (!entry.icon || !ICON_SYMBOL_SCHEME_PATTERN.test(entry.icon)) {
            return null;
          }

          const parts = entry.icon.split(':');
          const iconName = parts[1];
          const iconScheme = entry.icon.slice(0, 'icon:'.length);
          const nextIcon = iconName ? `${iconScheme}${iconName}:${newColor}` : entry.icon;
          if (!iconName || nextIcon === entry.icon) {
            return null;
          }

          return {
            path,
            updates: { icon: nextIcon },
          };
        })
        .filter((entry): entry is { path: string; updates: { icon: string } } => entry !== null);

      void Promise.resolve(updateManyNoteMetadata(updates)).catch(() => undefined);
    },

    updateAllEmojiSkinTones: async (newTone: number) => {
      const { noteMetadata } = get();
      if (!noteMetadata) return;
      const { EMOJI_MAP } = await import('@/components/common/UniversalIconPicker/constants');

      const updates = Object.entries(noteMetadata.notes)
        .map(([path, entry]) => {
          if (hasInternalNotePathSegment(path)) {
            return null;
          }
          if (!isSafeStoredNotePath(path)) {
            return null;
          }

          const icon = entry.icon;
          if (!icon || ICON_SYMBOL_SCHEME_PATTERN.test(icon)) {
            return null;
          }

          const item = EMOJI_MAP.get(icon);
          if (!item || !item.skins || item.skins.length <= newTone) {
            return null;
          }

          const nextIcon =
            newTone === 0 ? item.native : (item.skins[newTone]?.native || item.native);
          if (nextIcon === icon) {
            return null;
          }

          return {
            path,
            updates: { icon: nextIcon },
          };
        })
        .filter((entry): entry is { path: string; updates: { icon: string } } => entry !== null);

      await updateManyNoteMetadata(updates);
    },

    getNoteCover: (path: string) => {
      const { noteMetadata } = get();
      return noteMetadata?.notes[path]?.cover;
    },

    setNoteCover: (path: string, cover: NoteCoverMetadata | null) => {
      void Promise.resolve(updateSingleNoteMetadata(path, {
        cover: cover?.assetPath
          ? {
              assetPath: cover.assetPath,
              positionX: cover.positionX ?? 50,
              positionY: cover.positionY ?? 50,
              height: cover.height,
              scale: cover.scale ?? 1,
            }
          : undefined,
      })).catch(() => undefined);
    },

    getNoteIconSize: (_path: string) => {
      return get().noteIconSize;
    },

    setGlobalIconSize: (size: number) => {
      const normalized = persistGlobalNoteIconSize(size);
      set({ noteIconSize: normalized });
    },

    setNoteIconSize: (_path: string, size: number) => {
      const normalized = persistGlobalNoteIconSize(size);
      set({ noteIconSize: normalized });
    },
  };
};
