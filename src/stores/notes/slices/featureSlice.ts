/**
 * Feature Slice - Notes features like favorites, icons, backlinks, tags
 */

import { StateCreator } from 'zustand';
import { getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import { NotesStore, FileTreeNode, MetadataFile } from '../types';
import {
  saveFavoritesToFile,
  loadRecentNotes,
  loadFavoritesFromFile,
  loadNoteMetadata,
  saveNoteMetadata,
  setNoteEntry,
} from '../storage';
import { EMOJI_MAP } from '@/components/Notes/features/IconPicker/constants';

export interface FeatureSlice {
  recentNotes: NotesStore['recentNotes'];
  noteContentsCache: NotesStore['noteContentsCache'];
  starredNotes: NotesStore['starredNotes'];
  starredFolders: NotesStore['starredFolders'];
  favoritesLoaded: NotesStore['favoritesLoaded'];
  noteMetadata: MetadataFile | null;

  loadFavorites: (vaultPath: string) => Promise<void>;
  loadMetadata: (vaultPath: string) => Promise<void>;
  scanAllNotes: () => Promise<void>;
  getBacklinks: (notePath: string) => { path: string; name: string; context: string }[];
  getAllTags: () => { tag: string; count: number }[];
  toggleStarred: (path: string) => void;
  toggleFolderStarred: (path: string) => void;
  isStarred: (path: string) => boolean;
  isFolderStarred: (path: string) => boolean;
  getNoteIcon: (path: string) => string | undefined;
  setNoteIcon: (path: string, emoji: string | null) => void;
  updateAllIconColors: (newColor: string) => void;
  updateAllEmojiSkinTones: (newTone: number) => void;
  getNoteCover: (path: string) => { cover?: string; coverY?: number; coverH?: number };
  setNoteCover: (path: string, cover: string | null, coverY?: number, coverH?: number) => void;
}

export const createFeatureSlice: StateCreator<NotesStore, [], [], FeatureSlice> = (set, get) => ({
  recentNotes: loadRecentNotes(),
  noteContentsCache: new Map(),
  starredNotes: [],
  starredFolders: [],
  favoritesLoaded: false,
  noteMetadata: null,

  loadFavorites: async (vaultPath: string) => {
    const data = await loadFavoritesFromFile(vaultPath);
    set({ starredNotes: data.notes, starredFolders: data.folders, favoritesLoaded: true });
  },

  loadMetadata: async (vaultPath: string) => {
    const metadata = await loadNoteMetadata(vaultPath);
    set({ noteMetadata: metadata });
  },


  scanAllNotes: async () => {
    const { notesPath, rootFolder } = get();
    if (!rootFolder || !notesPath) return;

    const storage = getStorageAdapter();
    const cache = new Map<string, string>();
    const filePaths: { path: string; fullPath: string }[] = [];

    // Collect all file paths recursively
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

    // Read files in batches for better performance
    const BATCH_SIZE = 10;
    for (let i = 0; i < filePaths.length; i += BATCH_SIZE) {
      const batch = filePaths.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(async ({ path, fullPath }) => {
          const content = await storage.readFile(fullPath);
          return { path, content };
        })
      );

      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          cache.set(result.value.path, result.value.content);
        }
      });
    }

    set({ noteContentsCache: cache });
  },

  getBacklinks: (notePath: string) => {
    const { noteContentsCache } = get();
    const results: { path: string; name: string; context: string }[] = [];
    const noteName = notePath.split('/').pop()?.replace('.md', '').toLowerCase() || '';

    const patterns = [
      new RegExp(`\\[\\[${noteName}\\]\\]`, 'gi'),
      new RegExp(`\\[\\[${noteName}\\|[^\\]]+\\]\\]`, 'gi'),
    ];

    noteContentsCache.forEach((content, path) => {
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

          const fileName = path.split('/').pop()?.replace('.md', '') || path;
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

    noteContentsCache.forEach((content) => {
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
    const { starredNotes, starredFolders, notesPath } = get();
    const isCurrentlyStarred = starredNotes.includes(path);
    const updated = isCurrentlyStarred
      ? starredNotes.filter((p) => p !== path)
      : [...starredNotes, path];
    set({ starredNotes: updated });
    if (notesPath) saveFavoritesToFile(notesPath, { notes: updated, folders: starredFolders });
  },

  toggleFolderStarred: (path: string) => {
    const { starredNotes, starredFolders, notesPath } = get();
    const isCurrentlyStarred = starredFolders.includes(path);
    const updated = isCurrentlyStarred
      ? starredFolders.filter((p) => p !== path)
      : [...starredFolders, path];
    set({ starredFolders: updated });
    if (notesPath) saveFavoritesToFile(notesPath, { notes: starredNotes, folders: updated });
  },

  isStarred: (path: string) => get().starredNotes.includes(path),

  isFolderStarred: (path: string) => get().starredFolders.includes(path),

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

  updateAllEmojiSkinTones: (newTone: number) => {
    const { noteMetadata, notesPath } = get();
    if (!noteMetadata || !notesPath) return;

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
    return { cover: entry.cover, coverY: entry.coverY, coverH: entry.coverH };
  },

  setNoteCover: (path: string, cover: string | null, coverY?: number, coverH?: number) => {
    const { noteMetadata, notesPath } = get();
    if (!noteMetadata || !notesPath) return;

    const updates = cover
      ? { cover, coverY: coverY ?? 50, coverH: coverH }
      : { cover: undefined, coverY: undefined, coverH: undefined };

    const updated = setNoteEntry(noteMetadata, path, updates);
    set({ noteMetadata: updated });
    saveNoteMetadata(notesPath, updated);
  },
});

