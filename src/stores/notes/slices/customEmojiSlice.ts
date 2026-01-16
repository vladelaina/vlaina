import { StateCreator } from 'zustand';
import { getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import { NotesStore } from '../types';

export interface CustomEmoji {
    id: string; // Unique ID (e.g., timestamp or name)
    name: string; // User defined name
    url: string; // Internal asset URL (e.g. img:icons/logo.png)
    createdAt: number;
}

export interface CustomEmojiSlice {
    workspaceEmojis: CustomEmoji[];
    loadWorkspaceEmojis: () => Promise<void>;
    addWorkspaceEmoji: (emoji: CustomEmoji) => Promise<void>;
    removeWorkspaceEmoji: (id: string) => Promise<void>;
}

export const createCustomEmojiSlice: StateCreator<NotesStore, [], [], CustomEmojiSlice> = (set, get) => ({
    workspaceEmojis: [],

    loadWorkspaceEmojis: async () => {
        const { notesPath } = get();
        if (!notesPath) return;

        const storage = getStorageAdapter();
        try {
            // Path: .nekotick/assets/icons
            const iconsDir = await joinPath(notesPath, '.nekotick', 'assets', 'icons');

            if (!await storage.exists(iconsDir)) {
                set({ workspaceEmojis: [] });
                return;
            }

            const entries = await storage.listDir(iconsDir);

            const emojis: CustomEmoji[] = entries
                .filter(entry => !entry.isDirectory && !entry.name.startsWith('.'))
                .map(entry => {
                    // Use filename as ID and Name
                    const name = entry.name.replace(/\.[^/.]+$/, "");
                    return {
                        id: entry.name,
                        name: name,
                        url: `img:icons/${entry.name}`,
                        // Use current time as fallback for createdAt since we don't track it on file
                        createdAt: Date.now()
                    };
                })
                .sort((a, b) => b.name.localeCompare(a.name)); // Sort by name (which usually includes timestamp)

            set({ workspaceEmojis: emojis });
        } catch (e) {
            console.error('Failed to load workspace emojis', e);
            set({ workspaceEmojis: [] });
        }
    },

    addWorkspaceEmoji: async (emoji: CustomEmoji) => {
        // File is already saved by uploadAsset.
        // We just update the local state to reflect the new addition immediately.
        const { workspaceEmojis } = get();
        const updated = [...workspaceEmojis, emoji];
        set({ workspaceEmojis: updated });
    },

    removeWorkspaceEmoji: async (id: string) => {
        const { notesPath, workspaceEmojis } = get();
        if (!notesPath) return;

        // Optimistic UI update
        const updated = workspaceEmojis.filter(e => e.id !== id);
        set({ workspaceEmojis: updated });

        const storage = getStorageAdapter();
        try {
            // ID is the filename in our new system
            const filePath = await joinPath(notesPath, '.nekotick', 'assets', 'icons', id);
            if (await storage.exists(filePath)) {
                await storage.deleteFile(filePath);
            }
        } catch (e) {
            console.error('Failed to delete workspace emoji file', e);
            // Optionally revert state if delete fails, but for UI responsiveness we usually keep it removed directly
        }
    }
});
