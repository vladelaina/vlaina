import { StateCreator } from 'zustand';
import { getStorageAdapter, isAbsolutePath } from '@/lib/storage/adapter';
import { joinPath as joinLocalPath } from '@/lib/storage/adapter/pathUtils';
import { getNoteTitleFromPath } from '@/lib/notes/displayName';
import { NotesStore, FileTreeNode, MetadataFile, NoteCoverMetadata, NoteMetadataEntry } from '../types';
import {
  createEmptyMetadataFile,
  loadGlobalNoteIconSize,
  loadRecentNotes,
  loadNoteMetadata,
  persistGlobalNoteIconSize,
  safeWriteTextFile,
} from '../storage';
import {
  findStarredEntryByPath,
  loadStarredForVault,
  removeStarredEntryById,
  toggleStarredEntry,
} from '../starred';
import {
  getCachedNoteModifiedAt,
  pruneCachedNoteContents,
  setCachedNoteContent,
} from '../document/noteContentCache';
import { setNoteTabDirtyState } from '../document/noteTabState';
import { isDraftNotePath } from '../draftNote';
import { markExpectedExternalChange } from '../document/externalChangeRegistry';
import { updateNoteMetadataInMarkdown } from '../frontmatter';
import { buildSortedRootFolder } from '../utils/fs/rootFolderState';
import { normalizeVaultRelativePath, resolveVaultRelativeFullPath } from '../utils/fs/vaultPathContainment';
import { normalizeSerializedMarkdownDocument } from '@/lib/notes/markdown/markdownSerializationUtils';
import { logNotesDebug } from '../lineBreakDebugLog';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const MAX_SEARCHABLE_NOTE_BYTES = 512 * 1024;
const MAX_SCANNED_NOTE_CONTENT_CHARS = 8 * 1024 * 1024;
const MAX_METADATA_UPDATE_NOTE_BYTES = 10 * 1024 * 1024;

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
  ) => {
    const latestState = get();
    const latestCurrentNote = latestState.currentNote;
    const isCurrentNote = latestCurrentNote?.path === path;
    const latestContent = isCurrentNote
      ? latestCurrentNote.content
      : latestState.noteContentsCache.get(path)?.content;
    const hasNewerContent =
      latestContent !== undefined &&
      latestContent !== content;
    const nextContent = hasNewerContent ? latestContent : content;

    set({
      noteContentsCache: setCachedNoteContent(
        latestState.noteContentsCache,
        path,
        nextContent,
        modifiedAt,
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

  const writeNoteContent = async (path: string, content: string, vaultPath: string) => {
    const fullPath = isAbsolutePath(path)
      ? path
      : vaultPath
        ? (await resolveVaultRelativeFullPath(vaultPath, path)).fullPath
        : null;

    if (!fullPath || !isActiveVaultRequest(vaultPath)) {
      return getCachedNoteModifiedAt(get().noteContentsCache, path);
    }

    const storage = getStorageAdapter();
    markExpectedExternalChange(fullPath);
    await safeWriteTextFile(fullPath, content);
    const fileInfo = await storage.stat(fullPath);
    return fileInfo?.modifiedAt ?? getCachedNoteModifiedAt(get().noteContentsCache, path);
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

  const updateSingleNoteMetadata = async (
    path: string,
    updates: Partial<NoteMetadataEntry>
  ) => {
    logNotesDebug('NotesMetadataUpdate', 'single:start', {
      path,
      updateKeys: Object.keys(updates),
      cover: updates.cover,
      icon: updates.icon,
    });
    const state = get();
    const vaultPathAtStart = state.notesPath;
    const isDraftMetadataTarget = isDraftNotePath(path);
    if (!vaultPathAtStart) {
      logNotesDebug('NotesMetadataUpdate', 'single:no-vault', {
        path,
        isAbsolutePath: isAbsolutePath(path),
        isDraftMetadataTarget,
      });
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
          if (fileInfo?.size && fileInfo.size > MAX_METADATA_UPDATE_NOTE_BYTES) {
            set({ error: 'Note file is too large to update metadata.' });
            return;
          }
          sourceContent = await storage.readFile(path);
          latestState = get();
          metadataBase = latestState.noteMetadata ?? createEmptyMetadataFile();
          isCurrentNote = latestState.currentNote?.path === path;
          sourceContent =
            (isCurrentNote ? latestState.currentNote?.content : undefined) ??
            latestState.noteContentsCache.get(path)?.content ??
            sourceContent;
        }

        const normalizedSourceContent = normalizeSerializedMarkdownDocument(sourceContent);
        const { content, metadata } = updateNoteMetadataInMarkdown(normalizedSourceContent, {
          ...updates,
          updatedAt: Date.now(),
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
        logNotesDebug('NotesMetadataUpdate', 'single:absolute-state-updated', {
          path,
          updateKeys: Object.keys(updates),
          isCurrentNote,
        });

        if (isCurrentNote && latestState.isDirty) {
          logNotesDebug('NotesMetadataUpdate', 'single:absolute-skip-write-dirty-current', { path });
          return;
        }

        try {
          logNotesDebug('NotesMetadataUpdate', 'single:absolute-write:start', { path });
          const modifiedAt = await writeNoteContent(path, content, '');
          applyCompletedMetadataWrite(path, content, modifiedAt);
          logNotesDebug('NotesMetadataUpdate', 'single:absolute-write:done', {
            path,
            modifiedAt,
          });
        } catch (error) {
          logNotesDebug('NotesMetadataUpdate', 'single:absolute-write:error', {
            path,
            message: error instanceof Error ? error.message : String(error),
          });
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
        logNotesDebug('NotesMetadataUpdate', 'single:draft-updated', {
          path,
          updateKeys: Object.keys(updates),
        });

        return;
      }

      logNotesDebug('NotesMetadataUpdate', 'single:no-vault-skipped', { path });
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
        logNotesDebug('NotesMetadataUpdate', 'single:resolve-error', {
          path,
          message: error instanceof Error ? error.message : String(error),
        });
        set({ error: error instanceof Error ? error.message : 'Failed to update note metadata' });
        return;
      }

      if (!fullPath) {
        logNotesDebug('NotesMetadataUpdate', 'single:missing-full-path', { path });
        return;
      }

      const storage = getStorageAdapter();
      const fileInfo = await storage.stat(fullPath).catch(() => null);
      if (fileInfo?.size && fileInfo.size > MAX_METADATA_UPDATE_NOTE_BYTES) {
        set({ error: 'Note file is too large to update metadata.' });
        return;
      }
      sourceContent = await storage.readFile(fullPath);
      if (!isActiveVaultRequest(vaultPathAtStart)) {
        logNotesDebug('NotesMetadataUpdate', 'single:stale-after-read', {
          path,
          vaultPathAtStart,
          activeNotesPath: get().notesPath,
        });
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

    const normalizedSourceContent = normalizeSerializedMarkdownDocument(sourceContent);
    const { content, metadata } = updateNoteMetadataInMarkdown(normalizedSourceContent, {
      ...updates,
      updatedAt: Date.now(),
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
      logNotesDebug('NotesMetadataUpdate', 'single:stale-before-state-update', {
        path,
        vaultPathAtStart,
        activeNotesPath: get().notesPath,
      });
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
    logNotesDebug('NotesMetadataUpdate', 'single:state-updated', {
      path,
      updateKeys: Object.keys(updates),
      isCurrentNote,
      isDraftNote,
    });

    if (isDraftNote) {
      const draftNote = latestState.draftNotes[path];
      const canImplicitlySaveDraft =
        Boolean(isCurrentNote && vaultPathAtStart) &&
        Boolean(draftNote) &&
        (draftNote.originNotesPath === undefined || draftNote.originNotesPath === vaultPathAtStart);
      if (canImplicitlySaveDraft) {
        logNotesDebug('NotesMetadataUpdate', 'single:draft-save:start', { path });
        await get().saveNote({ explicit: false });
        logNotesDebug('NotesMetadataUpdate', 'single:draft-save:done', { path });
      }
      return;
    }

    if (isCurrentNote && latestState.isDirty) {
      logNotesDebug('NotesMetadataUpdate', 'single:skip-write-dirty-current', { path });
      return;
    }

    try {
      logNotesDebug('NotesMetadataUpdate', 'single:write:start', { path, vaultPathAtStart });
      const modifiedAt = await writeNoteContent(path, content, vaultPathAtStart);
      if (!isActiveVaultRequest(vaultPathAtStart)) {
        logNotesDebug('NotesMetadataUpdate', 'single:stale-after-write', {
          path,
          vaultPathAtStart,
          activeNotesPath: get().notesPath,
        });
        return;
      }
      applyCompletedMetadataWrite(path, content, modifiedAt);
      logNotesDebug('NotesMetadataUpdate', 'single:write:done', {
        path,
        modifiedAt,
      });
    } catch (error) {
      logNotesDebug('NotesMetadataUpdate', 'single:write:error', {
        path,
        message: error instanceof Error ? error.message : String(error),
      });
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
      if (!rootFolder || !notesPath || !isScanActive()) {
        externalSignal?.removeEventListener('abort', abortFromExternalSignal);
        if (noteContentScanController === scanController) {
          noteContentScanController = null;
        }
        return;
      }

      try {
        const storage = getStorageAdapter();
        const scannedCache: NotesStore['noteContentsCache'] = new Map();
        const filePaths: { path: string; fullPath: string }[] = [];
        const filePathsToRead: { path: string; fullPath: string }[] = [];

        const collectPaths = (nodes: FileTreeNode[]) => {
          for (const node of nodes) {
            if (!isScanActive()) {
              return;
            }

            if (node.isFolder) {
              collectPaths(node.children);
            } else {
              const relativePath = normalizeVaultRelativePath(node.path);
              if (relativePath) {
                filePaths.push({
                  path: relativePath,
                  fullPath: joinLocalPath(notesPath, relativePath),
                });
              }
            }
          }
        };

        collectPaths(rootFolder.children);
        if (!isScanActive()) {
          return;
        }

        let scannedContentChars = 0;
        const addScannedEntry = (path: string, content: string, modifiedAt: number | null) => {
          if (scannedContentChars >= MAX_SCANNED_NOTE_CONTENT_CHARS) {
            scannedCache.set(path, { content: '', modifiedAt });
            return;
          }

          const nextContent =
            scannedContentChars + content.length <= MAX_SCANNED_NOTE_CONTENT_CHARS
              ? content
              : '';

          scannedContentChars += nextContent.length;
          scannedCache.set(path, {
            content: nextContent,
            modifiedAt,
          });
        };

        for (const filePath of filePaths) {
          if (!isScanActive()) {
            return;
          }

          const cachedEntry = noteContentsCache.get(filePath.path);
          if (cachedEntry) {
            addScannedEntry(filePath.path, cachedEntry.content, cachedEntry.modifiedAt);
            continue;
          }

          filePathsToRead.push(filePath);
        }

        const BATCH_SIZE = 10;
        for (let i = 0; i < filePathsToRead.length; i += BATCH_SIZE) {
          if (!isScanActive()) {
            return;
          }

          const batch = filePathsToRead.slice(i, i + BATCH_SIZE);
          if (scannedContentChars >= MAX_SCANNED_NOTE_CONTENT_CHARS) {
            batch.forEach(({ path }) => addScannedEntry(path, '', null));
            continue;
          }

          const results = await Promise.allSettled(
            batch.map(async ({ path, fullPath }) => {
              if (!isScanActive()) {
                return { path, content: '', modifiedAt: null };
              }

              let modifiedAt: number | null = null;
              try {
                const fileInfo = await storage.stat(fullPath);
                if (!isScanActive()) {
                  return { path, content: '', modifiedAt: null };
                }
                modifiedAt = fileInfo?.modifiedAt ?? null;
                if (fileInfo?.size && fileInfo.size > MAX_SEARCHABLE_NOTE_BYTES) {
                  return { path, content: '', modifiedAt };
                }
              } catch {
                // Some adapters/tests may not expose stat; still read the note content.
              }

              try {
                const content = normalizeSerializedMarkdownDocument(await storage.readFile(fullPath));
                if (!isScanActive()) {
                  return { path, content: '', modifiedAt: null };
                }
                return { path, content, modifiedAt };
              } catch {
                return { path, content: '', modifiedAt: null };
              }
            })
          );

          if (!isScanActive()) {
            return;
          }

          results.forEach((result) => {
            if (result.status === 'fulfilled') {
              addScannedEntry(result.value.path, result.value.content, result.value.modifiedAt);
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
          cache.set(latestState.currentNote.path, {
            content: latestState.currentNote.content,
            modifiedAt: currentEntry?.modifiedAt ?? null,
          });
        }
        latestState.openTabs.forEach((tab) => {
          if (tab.path === latestState.currentNote?.path) {
            return;
          }

          const cachedEntry = latestState.noteContentsCache.get(tab.path);
          if (cachedEntry) {
            cache.set(tab.path, cachedEntry);
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
      const { noteContentsCache } = get();
      const results: { path: string; name: string; context: string }[] = [];
      const noteName = getNoteTitleFromPath(notePath).toLowerCase();
      const escapedNoteName = escapeRegExp(noteName);

      const patterns = [
        new RegExp(`\\[\\[${escapedNoteName}\\]\\]`, 'gi'),
        new RegExp(`\\[\\[${escapedNoteName}\\|[^\\]]+\\]\\]`, 'gi'),
      ];

      noteContentsCache.forEach((entry, path) => {
        const content = entry.content;
        if (path === notePath || !content.includes('[[')) return;

        for (const pattern of patterns) {
          pattern.lastIndex = 0;
          const match = pattern.exec(content);
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
      const tagRegex = /(?:^|\s)#([a-zA-Z][a-zA-Z0-9_/-]*)/g;

      noteContentsCache.forEach((entry) => {
        const content = entry.content;
        let match;
        while ((match = tagRegex.exec(content)) !== null) {
          const tag = match[1].toLowerCase();
          tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
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
      void updateSingleNoteMetadata(path, { icon: emoji ?? undefined });
    },

    updateAllIconColors: (newColor: string) => {
      const { noteMetadata } = get();
      if (!noteMetadata) return;

      const updates = Object.entries(noteMetadata.notes)
        .map(([path, entry]) => {
          if (!entry.icon?.startsWith('icon:')) {
            return null;
          }

          const parts = entry.icon.split(':');
          const iconName = parts[1];
          const nextIcon = iconName ? `icon:${iconName}:${newColor}` : entry.icon;
          if (!iconName || nextIcon === entry.icon) {
            return null;
          }

          return {
            path,
            updates: { icon: nextIcon },
          };
        })
        .filter((entry): entry is { path: string; updates: { icon: string } } => entry !== null);

      void updateManyNoteMetadata(updates);
    },

    updateAllEmojiSkinTones: async (newTone: number) => {
      const { noteMetadata } = get();
      if (!noteMetadata) return;
      const { EMOJI_MAP } = await import('@/components/common/UniversalIconPicker/constants');

      const updates = Object.entries(noteMetadata.notes)
        .map(([path, entry]) => {
          const icon = entry.icon;
          if (!icon || icon.startsWith('icon:')) {
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
      void updateSingleNoteMetadata(path, {
        cover: cover?.assetPath
          ? {
              assetPath: cover.assetPath,
              positionX: cover.positionX ?? 50,
              positionY: cover.positionY ?? 50,
              height: cover.height,
              scale: cover.scale ?? 1,
            }
          : undefined,
      });
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
