import { StateCreator } from 'zustand';
import { readTextFile } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';
import { NotesStore, FileTreeNode } from '../types';
import { saveFavoritesToFile, saveNoteIconsToFile, loadRecentNotes, loadFavoritesFromFile, loadNoteIconsFromFile } from '../storage';

export interface FeatureSlice {
    recentNotes: NotesStore['recentNotes'];
    noteContentsCache: NotesStore['noteContentsCache'];
    starredNotes: NotesStore['starredNotes'];
    starredFolders: NotesStore['starredFolders'];
    noteIcons: NotesStore['noteIcons'];

    loadFavorites: (vaultPath: string) => Promise<void>;
    loadNoteIcons: (vaultPath: string) => Promise<void>;
    scanAllNotes: () => Promise<void>;
    getBacklinks: (notePath: string) => { path: string; name: string; context: string }[];
    getAllTags: () => { tag: string; count: number }[];
    toggleStarred: (path: string) => void;
    toggleFolderStarred: (path: string) => void;
    isStarred: (path: string) => boolean;
    isFolderStarred: (path: string) => boolean;
    getNoteIcon: (path: string) => string | undefined;
    setNoteIcon: (path: string, emoji: string | null) => void;
}

export const createFeatureSlice: StateCreator<NotesStore, [], [], FeatureSlice> = (set, get) => ({
    recentNotes: loadRecentNotes(),
    // Wait, loadRecentNotes was called in initial state. 
    // Here we just define initial value. We should import loadRecentNotes if we want initial state to be correct on store creation.

    noteContentsCache: new Map(),
    starredNotes: [],
    starredFolders: [],
    noteIcons: new Map(),

    loadFavorites: async (vaultPath: string) => {
        const data = await loadFavoritesFromFile(vaultPath);
        set({ starredNotes: data.notes, starredFolders: data.folders });
    },

    loadNoteIcons: async (vaultPath: string) => {
        const icons = await loadNoteIconsFromFile(vaultPath);
        set({ noteIcons: icons });
    },

    scanAllNotes: async () => {
        const { notesPath, rootFolder } = get();
        if (!rootFolder || !notesPath) return;

        const cache = new Map<string, string>();
        const filePaths: { path: string; fullPath: string }[] = [];

        // Recursive helper could be imported or defined here
        const collectPaths = async (nodes: FileTreeNode[]) => {
            for (const node of nodes) {
                if (node.isFolder) {
                    await collectPaths(node.children);
                } else {
                    const fullPath = await join(notesPath, node.path);
                    filePaths.push({ path: node.path, fullPath });
                }
            }
        };

        await collectPaths(rootFolder.children);

        const BATCH_SIZE = 10;
        for (let i = 0; i < filePaths.length; i += BATCH_SIZE) {
            const batch = filePaths.slice(i, i + BATCH_SIZE);
            const results = await Promise.allSettled(batch.map(async ({ path, fullPath }) => {
                const content = await readTextFile(fullPath);
                return { path, content };
            }));

            results.forEach((result) => {
                if (result.status === 'fulfilled') cache.set(result.value.path, result.value.content);
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

        return Array.from(tagCounts.entries()).map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count);
    },

    toggleStarred: (path: string) => {
        const { starredNotes, starredFolders, notesPath } = get();
        const isCurrentlyStarred = starredNotes.includes(path);
        const updated = isCurrentlyStarred ? starredNotes.filter(p => p !== path) : [...starredNotes, path];
        set({ starredNotes: updated });
        if (notesPath) saveFavoritesToFile(notesPath, { notes: updated, folders: starredFolders });
    },

    toggleFolderStarred: (path: string) => {
        const { starredNotes, starredFolders, notesPath } = get();
        const isCurrentlyStarred = starredFolders.includes(path);
        const updated = isCurrentlyStarred ? starredFolders.filter(p => p !== path) : [...starredFolders, path];
        set({ starredFolders: updated });
        if (notesPath) saveFavoritesToFile(notesPath, { notes: starredNotes, folders: updated });
    },

    isStarred: (path: string) => get().starredNotes.includes(path),

    isFolderStarred: (path: string) => get().starredFolders.includes(path),

    getNoteIcon: (path: string) => get().noteIcons.get(path),

    setNoteIcon: (path: string, emoji: string | null) => {
        const { noteIcons, notesPath } = get();
        const updated = new Map(noteIcons);
        if (emoji) updated.set(path, emoji);
        else updated.delete(path);
        if (notesPath) saveNoteIconsToFile(notesPath, updated);
        set({ noteIcons: updated });
    },
});
