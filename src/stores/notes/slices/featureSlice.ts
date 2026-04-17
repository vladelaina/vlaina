import { StateCreator } from 'zustand';
import { getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import { getNoteTitleFromPath } from '@/lib/notes/displayName';
import { NotesStore, FileTreeNode, MetadataFile } from '../types';
import {
  loadRecentNotes,
  loadNoteMetadata,
  saveNoteMetadata,
  setNoteEntry,
} from '../storage';
import {
  loadStarredForVault,
  removeStarredEntryById,
  toggleStarredEntry,
} from '../starred';
import { pruneCachedNoteContents, setCachedNoteContent } from '../document/noteContentCache';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

  loadStarred: (vaultPath: string) => Promise<void>;
  loadMetadata: (vaultPath: string) => Promise<void>;
  scanAllNotes: () => Promise<void>;
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
  getNoteCover: (path: string) => { cover?: string; coverX?: number; coverY?: number; coverH?: number; coverScale?: number };
  setNoteCover: (path: string, cover: string | null, coverX?: number, coverY?: number, coverH?: number, coverScale?: number) => void;
  getNoteIconSize: (path: string) => number | undefined;
  setNoteIconSize: (path: string, size: number) => void;
  setGlobalIconSize: (size: number) => void;
}

export const createFeatureSlice: StateCreator<NotesStore, [], [], FeatureSlice> = (set, get) => ({
  recentNotes: loadRecentNotes(),
  noteContentsCache: new Map(),
  starredEntries: [],
  starredNotes: [],
  starredFolders: [],
  starredLoaded: false,
  pendingStarredNavigation: null,
  noteMetadata: null,

  loadStarred: async (vaultPath: string) => {
    await loadStarredForVault(set, get, vaultPath);
  },

  loadMetadata: async (vaultPath: string) => {
    const metadata = await loadNoteMetadata(vaultPath);
    set({ noteMetadata: metadata });
  },


  scanAllNotes: async () => {
    const { notesPath, rootFolder, currentNote, noteContentsCache } = get();
    if (!rootFolder || !notesPath) return;

    const storage = getStorageAdapter();
    let cache: NotesStore['noteContentsCache'] = noteContentsCache;
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

    const validPaths = new Set(filePaths.map(({ path }) => path));
    cache = pruneCachedNoteContents(cache, (cachedPath) => !validPaths.has(cachedPath));

    const BATCH_SIZE = 10;
    const pathsToRead = filePaths.filter(({ path }) => path !== currentNote?.path && !cache.has(path));

    if (currentNote) {
      const currentEntry = cache.get(currentNote.path) ?? noteContentsCache.get(currentNote.path);
      cache = setCachedNoteContent(
        cache,
        currentNote.path,
        currentNote.content,
        currentEntry?.modifiedAt ?? null
      );
    }

    if (cache !== noteContentsCache) {
      set({ noteContentsCache: cache });
    }

    for (let i = 0; i < pathsToRead.length; i += BATCH_SIZE) {
      const batch = pathsToRead.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(async ({ path, fullPath }) => {
          const content = await storage.readFile(fullPath);
          return { path, content };
        })
      );

      let didBatchChange = false;
      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          cache = setCachedNoteContent(cache, result.value.path, result.value.content, null);
          didBatchChange = true;
        }
      });

      if (didBatchChange) {
        set({ noteContentsCache: cache });
      }
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
    const { noteMetadata, notesPath } = get();
    if (!noteMetadata || !notesPath) return;

    const updates = emoji ? { icon: emoji } : { icon: undefined };
    const updated = setNoteEntry(noteMetadata, path, updates);
    set({ noteMetadata: updated });
    saveNoteMetadata(notesPath, updated);
  },

  updateAllIconColors: (newColor: string) => {
    const { noteMetadata, notesPath } = get();
    if (!noteMetadata || !notesPath) return;

    let hasChanges = false;
    const updatedNotes = { ...noteMetadata.notes };

    Object.entries(updatedNotes).forEach(([path, entry]) => {
      if (entry.icon?.startsWith('icon:')) {
        const parts = entry.icon.split(':');
        const iconName = parts[1];
        const newIcon = `icon:${iconName}:${newColor}`;
        if (newIcon !== entry.icon) {
          updatedNotes[path] = { ...entry, icon: newIcon };
          hasChanges = true;
        }
      }
    });

    if (hasChanges) {
      const updated: MetadataFile = { ...noteMetadata, notes: updatedNotes };
      set({ noteMetadata: updated });
      saveNoteMetadata(notesPath, updated);
    }
  },

  updateAllEmojiSkinTones: async (newTone: number) => {
    const { noteMetadata, notesPath } = get();
    if (!noteMetadata || !notesPath) return;
    const { EMOJI_MAP } = await import('@/components/common/UniversalIconPicker/constants');

    let hasChanges = false;
    const updatedNotes = { ...noteMetadata.notes };

    Object.entries(updatedNotes).forEach(([path, entry]) => {
      const icon = entry.icon;
      if (!icon || icon.startsWith('icon:')) return;

      const item = EMOJI_MAP.get(icon);
      if (item && item.skins && item.skins.length > newTone) {
        const newEmoji = newTone === 0 ? item.native : (item.skins[newTone]?.native || item.native);
        if (newEmoji !== icon) {
          updatedNotes[path] = { ...entry, icon: newEmoji };
          hasChanges = true;
        }
      }
    });

    if (hasChanges) {
      const updated: MetadataFile = { ...noteMetadata, notes: updatedNotes };
      set({ noteMetadata: updated });
      saveNoteMetadata(notesPath, updated);
    }
  },

  getNoteCover: (path: string) => {
    const { noteMetadata } = get();
    if (!noteMetadata) return {};
    const entry = noteMetadata.notes[path];
    if (!entry) return {};
    return { cover: entry.cover, coverX: entry.coverX, coverY: entry.coverY, coverH: entry.coverH, coverScale: entry.coverScale };
  },

  setNoteCover: (path: string, cover: string | null, coverX?: number, coverY?: number, coverH?: number, coverScale?: number) => {
    const { noteMetadata, notesPath } = get();
    if (!noteMetadata || !notesPath) return;

    const updates = cover
      ? { cover, coverX: coverX ?? 50, coverY: coverY ?? 50, coverH: coverH, coverScale: coverScale ?? 1 }
      : { cover: undefined, coverX: undefined, coverY: undefined, coverH: undefined, coverScale: undefined };

    const updated = setNoteEntry(noteMetadata, path, updates);
    set({ noteMetadata: updated });
    saveNoteMetadata(notesPath, updated);
  },

  getNoteIconSize: (_path: string) => {
    const { noteMetadata } = get();
    return noteMetadata?.defaultIconSize ?? 60;
  },

  setGlobalIconSize: (size: number) => {
    const { noteMetadata, notesPath } = get();
    if (!noteMetadata || !notesPath) return;

    const updated: MetadataFile = { ...noteMetadata, defaultIconSize: size };
    set({ noteMetadata: updated });
    saveNoteMetadata(notesPath, updated);
  },

  setNoteIconSize: (path: string, size: number) => {
    const { noteMetadata, notesPath } = get();
    if (!noteMetadata || !notesPath) return;

    const updated = setNoteEntry(noteMetadata, path, { iconSize: size });
    set({ noteMetadata: updated });
    saveNoteMetadata(notesPath, updated);
  },
});
