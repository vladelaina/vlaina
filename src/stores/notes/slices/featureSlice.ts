import { StateCreator } from 'zustand';
import { getStorageAdapter, isAbsolutePath, joinPath } from '@/lib/storage/adapter';
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
import { normalizeSerializedMarkdownDocument } from '@/lib/notes/markdown/markdownSerializationUtils';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const MAX_SEARCHABLE_NOTE_BYTES = 512 * 1024;
const MAX_SCANNED_NOTE_CONTENT_CHARS = 8 * 1024 * 1024;

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
  scanAllNotes: () => Promise<void>;
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

  const writeNoteContent = async (path: string, content: string, vaultPath: string) => {
    const fullPath = isAbsolutePath(path)
      ? path
      : vaultPath
        ? await joinPath(vaultPath, path)
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

  const updateSingleNoteMetadata = async (
    path: string,
    updates: Partial<NoteMetadataEntry>
  ) => {
    const state = get();
    const vaultPathAtStart = state.notesPath;
    const isDraftMetadataTarget = isDraftNotePath(path);
    if (!vaultPathAtStart) {
      if (isAbsolutePath(path)) {
        const metadataBase = state.noteMetadata ?? createEmptyMetadataFile();
        const isCurrentNote = state.currentNote?.path === path;
        let sourceContent =
          (isCurrentNote ? state.currentNote?.content : undefined) ??
          state.noteContentsCache.get(path)?.content;

        if (sourceContent === undefined) {
          const storage = getStorageAdapter();
          sourceContent = await storage.readFile(path);
        }

        const normalizedSourceContent = normalizeSerializedMarkdownDocument(sourceContent);
        const { content, metadata } = updateNoteMetadataInMarkdown(normalizedSourceContent, {
          ...updates,
          updatedAt: Date.now(),
        });
        const nextMetadata = replaceNoteEntry(metadataBase, path, metadata);
        const cachedModifiedAt = getCachedNoteModifiedAt(state.noteContentsCache, path);
        let nextCache = setCachedNoteContent(state.noteContentsCache, path, content, cachedModifiedAt);

        set({
          noteMetadata: nextMetadata,
          noteContentsCache: nextCache,
          currentNote: isCurrentNote ? { path, content } : state.currentNote,
          error: null,
        });

        if (isCurrentNote && state.isDirty) {
          return;
        }

        try {
          const modifiedAt = await writeNoteContent(path, content, '');
          nextCache = setCachedNoteContent(nextCache, path, content, modifiedAt);
          set({
            noteContentsCache: nextCache,
            currentNote: isCurrentNote ? { path, content } : get().currentNote,
            error: null,
          });
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Failed to update note metadata' });
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

        return;
      }

      return;
    }

    const metadataBase = state.noteMetadata ?? createEmptyMetadataFile();
    const isCurrentNote = state.currentNote?.path === path;
    let sourceContent =
      (isCurrentNote ? state.currentNote?.content : undefined) ??
      state.noteContentsCache.get(path)?.content;

    if (sourceContent === undefined) {
      const fullPath = isAbsolutePath(path)
        ? path
        : vaultPathAtStart
          ? await joinPath(vaultPathAtStart, path)
          : null;

      if (!fullPath) {
        return;
      }

      const storage = getStorageAdapter();
      sourceContent = await storage.readFile(fullPath);
      if (!isActiveVaultRequest(vaultPathAtStart)) {
        return;
      }
    }

    const normalizedSourceContent = normalizeSerializedMarkdownDocument(sourceContent);
    const { content, metadata } = updateNoteMetadataInMarkdown(normalizedSourceContent, {
      ...updates,
      updatedAt: Date.now(),
    });
    const nextMetadata = replaceNoteEntry(metadataBase, path, metadata);
    const isDraftNote = isDraftMetadataTarget;
    const nextRootFolder = buildSortedRootFolder(
      state.rootFolder,
      state.rootFolder?.children ?? [],
      state.fileTreeSortMode,
      nextMetadata
    );
    const cachedModifiedAt = getCachedNoteModifiedAt(state.noteContentsCache, path);
    let nextCache = setCachedNoteContent(state.noteContentsCache, path, content, cachedModifiedAt);

    if (!isActiveVaultRequest(vaultPathAtStart)) {
      return;
    }

    set({
      noteMetadata: nextMetadata,
      rootFolder: nextRootFolder,
      noteContentsCache: nextCache,
      currentNote: isCurrentNote ? { path, content } : state.currentNote,
      isDirty: isCurrentNote && isDraftNote ? true : state.isDirty,
      openTabs: isCurrentNote && isDraftNote
        ? setNoteTabDirtyState(state.openTabs, path, true)
        : state.openTabs,
      error: null,
    });

    if (isDraftNote) {
      const draftNote = state.draftNotes[path];
      const canImplicitlySaveDraft =
        Boolean(isCurrentNote && vaultPathAtStart) &&
        Boolean(draftNote) &&
        (draftNote.originNotesPath === undefined || draftNote.originNotesPath === vaultPathAtStart);
      if (canImplicitlySaveDraft) {
        await get().saveNote({ explicit: false });
      }
      return;
    }

    if (isCurrentNote && state.isDirty) {
      return;
    }

    try {
      const modifiedAt = await writeNoteContent(path, content, vaultPathAtStart);
      if (!isActiveVaultRequest(vaultPathAtStart)) {
        return;
      }
      nextCache = setCachedNoteContent(nextCache, path, content, modifiedAt);
      set({
        noteContentsCache: nextCache,
        currentNote: isCurrentNote ? { path, content } : get().currentNote,
        error: null,
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to update note metadata' });
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

    scanAllNotes: async () => {
      const { notesPath, rootFolder, currentNote, openTabs, draftNotes, noteContentsCache } = get();
      if (!rootFolder || !notesPath) return;

      const storage = getStorageAdapter();
      const cache: NotesStore['noteContentsCache'] = new Map();
      const filePaths: { path: string; fullPath: string }[] = [];

      const collectPaths = async (nodes: FileTreeNode[]) => {
        for (const node of nodes) {
          if (node.isFolder) {
            await collectPaths(node.children);
          } else {
            const fullPath = await joinPath(notesPath, node.path);
            filePaths.push({ path: node.path, fullPath });
          }
        }
      };

      await collectPaths(rootFolder.children);

      const BATCH_SIZE = 10;
      let scannedContentChars = 0;
      for (let i = 0; i < filePaths.length; i += BATCH_SIZE) {
        const batch = filePaths.slice(i, i + BATCH_SIZE);
        if (scannedContentChars >= MAX_SCANNED_NOTE_CONTENT_CHARS) {
          batch.forEach(({ path }) => {
            cache.set(path, { content: '', modifiedAt: null });
          });
          continue;
        }

        const results = await Promise.allSettled(
          batch.map(async ({ path, fullPath }) => {
            let modifiedAt: number | null = null;
            try {
              const fileInfo = await storage.stat(fullPath);
              modifiedAt = fileInfo?.modifiedAt ?? null;
              if (fileInfo?.size && fileInfo.size > MAX_SEARCHABLE_NOTE_BYTES) {
                return { path, content: '', modifiedAt };
              }
            } catch {
              // Some adapters/tests may not expose stat; still read the note content.
            }

            try {
              const content = normalizeSerializedMarkdownDocument(await storage.readFile(fullPath));
              return { path, content, modifiedAt };
            } catch {
              return { path, content: '', modifiedAt: null };
            }
          })
        );

        results.forEach((result) => {
          if (result.status === 'fulfilled') {
            const content =
              scannedContentChars + result.value.content.length <= MAX_SCANNED_NOTE_CONTENT_CHARS
                ? result.value.content
                : '';

            scannedContentChars += content.length;
            cache.set(result.value.path, {
              content,
              modifiedAt: result.value.modifiedAt,
            });
          }
        });
      }

      if (currentNote) {
        const currentEntry = noteContentsCache.get(currentNote.path);
        cache.set(currentNote.path, {
          content: currentNote.content,
          modifiedAt: currentEntry?.modifiedAt ?? null,
        });
      }
      openTabs.forEach((tab) => {
        if (tab.path === currentNote?.path) {
          return;
        }

        const cachedEntry = noteContentsCache.get(tab.path);
        if (cachedEntry) {
          cache.set(tab.path, cachedEntry);
        }
      });
      Object.keys(draftNotes).forEach((path) => {
        const cachedEntry = noteContentsCache.get(path);
        if (cachedEntry) {
          cache.set(path, cachedEntry);
        }
      });

      if (!isActiveVaultRequest(notesPath)) {
        return;
      }

      set({ noteContentsCache: cache });
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

    isStarred: (path: string) => get().starredNotes.includes(path),

    isFolderStarred: (path: string) => get().starredFolders.includes(path),

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
