
import { StateCreator } from 'zustand';
import { readTextFile, writeTextFile, rename, exists, remove } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';
import { NotesStore } from '../types';
import { extractFirstH1, sanitizeFileName } from '../noteUtils';
import { updateDisplayName, moveDisplayName, removeDisplayName } from '../displayNameUtils';
import { addToRecentNotes, saveNoteIconsToFile, saveFavoritesToFile, saveWorkspaceState } from '../storage'; // Import storage helpers
import { updateFileNodePath, collectExpandedPaths, restoreExpandedState } from '../fileTreeUtils';

export interface WorkspaceSlice {
    currentNote: NotesStore['currentNote'];
    isDirty: NotesStore['isDirty'];
    isLoading: NotesStore['isLoading'];
    error: NotesStore['error'];
    openTabs: NotesStore['openTabs'];
    displayNames: NotesStore['displayNames'];

    openNote: (path: string, openInNewTab?: boolean) => Promise<void>;
    saveNote: () => Promise<void>;
    updateContent: (content: string) => void;
    closeNote: () => void;
    closeTab: (path: string) => Promise<void>;
    switchTab: (path: string) => void;
    reorderTabs: (fromIndex: number, toIndex: number) => void;
    syncDisplayName: (path: string, title: string) => void;
    getDisplayName: (path: string) => string;
}

export const createWorkspaceSlice: StateCreator<NotesStore, [], [], WorkspaceSlice> = (set, get) => ({
    currentNote: null,
    isDirty: false,
    isLoading: false,
    error: null,
    openTabs: [],
    displayNames: new Map(),

    openNote: async (path: string, openInNewTab: boolean = false) => {
        const { notesPath, isDirty, saveNote, recentNotes, openTabs, currentNote } = get();
        if (isDirty) await saveNote();

        try {
            const fullPath = await join(notesPath, path);
            const content = await readTextFile(fullPath);
            const h1Title = extractFirstH1(content);
            const tabName = h1Title || 'Untitled';
            const updatedRecent = addToRecentNotes(path, recentNotes);
            const existingTab = openTabs.find(t => t.path === path);

            let updatedTabs = openTabs;
            if (existingTab) {
                updatedTabs = openTabs.map(t => t.path === path ? { ...t, name: tabName } : t);
            } else if (openInNewTab || openTabs.length === 0) {
                updatedTabs = [...openTabs, { path, name: tabName, isDirty: false }];
            } else {
                const currentTabIndex = openTabs.findIndex(t => t.path === currentNote?.path);
                if (currentTabIndex !== -1) {
                    updatedTabs = [...openTabs];
                    updatedTabs[currentTabIndex] = { path, name: tabName, isDirty: false };
                } else {
                    updatedTabs = [...openTabs, { path, name: tabName, isDirty: false }];
                }
            }

            updateDisplayName(set, path, tabName);
            set({ currentNote: { path, content }, isDirty: false, error: null, recentNotes: updatedRecent, openTabs: updatedTabs, isNewlyCreated: false });

            // Save workspace state
            const { rootFolder } = get();
            if (notesPath && rootFolder) {
                const expandedPaths = collectExpandedPaths(rootFolder.children);
                saveWorkspaceState(notesPath, {
                    currentNotePath: path,
                    expandedFolders: Array.from(expandedPaths),
                });
            }
        } catch (error) {
            set({ error: error instanceof Error ? error.message : 'Failed to open note' });
        }
    },

    saveNote: async () => {
        const { currentNote, notesPath, openTabs, noteIcons, starredNotes } = get();
        if (!currentNote) return;

        try {
            const h1Title = extractFirstH1(currentNote.content);
            const currentFileName = currentNote.path.split('/').pop()?.replace('.md', '') || '';
            const dirPath = currentNote.path.includes('/') ? currentNote.path.substring(0, currentNote.path.lastIndexOf('/')) : '';

            if (h1Title && h1Title !== currentFileName) {
                const sanitizedTitle = sanitizeFileName(h1Title);
                const newFileName = `${sanitizedTitle}.md`;
                const newPath = dirPath ? `${dirPath}/${newFileName}` : newFileName;
                const newFullPath = await join(notesPath, newPath);
                const newFileExists = await exists(newFullPath);
                const oldFullPath = await join(notesPath, currentNote.path);

                if (!newFileExists || newFullPath === oldFullPath) {
                    await writeTextFile(oldFullPath, currentNote.content);

                    if (newPath !== currentNote.path) {
                        await rename(oldFullPath, newFullPath);

                        const icon = noteIcons.get(currentNote.path);
                        if (icon) {
                            const updatedIcons = new Map(noteIcons);
                            updatedIcons.delete(currentNote.path);
                            updatedIcons.set(newPath, icon);
                            saveNoteIconsToFile(notesPath, updatedIcons);
                            set({ noteIcons: updatedIcons });
                        }

                        if (starredNotes.includes(currentNote.path)) {
                            const updatedStarred = starredNotes.map(p => p === currentNote.path ? newPath : p);
                            const { starredFolders } = get();
                            saveFavoritesToFile(notesPath, { notes: updatedStarred, folders: starredFolders });
                            set({ starredNotes: updatedStarred });
                        }

                        const updatedTabs = openTabs.map(tab => tab.path === currentNote.path ? { ...tab, path: newPath, name: sanitizedTitle } : tab);
                        moveDisplayName(set, currentNote.path, newPath);
                        updateDisplayName(set, newPath, sanitizedTitle);

                        const currentRootFolder = get().rootFolder;
                        if (currentRootFolder) {
                            set({ rootFolder: { ...currentRootFolder, children: updateFileNodePath(currentRootFolder.children, currentNote.path, newPath, sanitizedTitle) } });
                        }

                        set({ currentNote: { path: newPath, content: currentNote.content }, isDirty: false, openTabs: updatedTabs });
                        return;
                    }
                }
            }

            const fullPath = await join(notesPath, currentNote.path);
            await writeTextFile(fullPath, currentNote.content);
            set({ isDirty: false });
        } catch (error) {
            set({ error: error instanceof Error ? error.message : 'Failed to save note' });
        }
    },

    updateContent: (content: string) => {
        const { currentNote } = get();
        if (!currentNote || currentNote.content === content) return;
        set({ currentNote: { ...currentNote, content }, isDirty: true });
    },

    closeNote: () => set({ currentNote: null, isDirty: false }),

    closeTab: async (path: string) => {
        const { openTabs, currentNote, isDirty, saveNote, notesPath, loadFileTree, rootFolder, starredNotes, starredFolders } = get();

        // Check if the note is empty and "untitled" (basic check) or just empty
        // The original logic checked for specific content to delete empty notes
        const isEmptyNote = currentNote?.path === path && (!currentNote.content.trim() || currentNote.content.trim() === '#' || currentNote.content.trim() === '# ');

        if (isEmptyNote) {
            try {
                const expandedPaths = rootFolder ? collectExpandedPaths(rootFolder.children) : new Set<string>();
                const fullPath = await join(notesPath, path);
                await remove(fullPath);
                removeDisplayName(set, path);

                // Remove from favorites if starred
                if (starredNotes.includes(path)) {
                    const updatedStarred = starredNotes.filter(p => p !== path);
                    set({ starredNotes: updatedStarred });
                    saveFavoritesToFile(notesPath, { notes: updatedStarred, folders: starredFolders });
                }

                await loadFileTree();

                const currentRootFolder = get().rootFolder;
                if (currentRootFolder) {
                    set({ rootFolder: { ...currentRootFolder, children: restoreExpandedState(currentRootFolder.children, expandedPaths) } });
                }
            } catch { /* ignore */ }
        } else if (currentNote?.path === path && isDirty) {
            await saveNote();
        }

        const updatedTabs = openTabs.filter(t => t.path !== path);
        set({ openTabs: updatedTabs });

        if (currentNote?.path === path) {
            if (updatedTabs.length > 0) {
                const lastTab = updatedTabs[updatedTabs.length - 1];
                get().openNote(lastTab.path);
            } else {
                set({ currentNote: null, isDirty: false });
                // Clear workspace current note when no tabs
                if (notesPath && rootFolder) {
                    const expandedPaths = collectExpandedPaths(rootFolder.children);
                    saveWorkspaceState(notesPath, {
                        currentNotePath: null,
                        expandedFolders: Array.from(expandedPaths),
                    });
                }
            }
        }
    },

    switchTab: (path: string) => get().openNote(path),

    reorderTabs: (fromIndex: number, toIndex: number) => {
        const { openTabs } = get();
        if (fromIndex === toIndex || fromIndex < 0 || fromIndex >= openTabs.length || toIndex < 0 || toIndex >= openTabs.length) return;

        const updatedTabs = [...openTabs];
        const [movedTab] = updatedTabs.splice(fromIndex, 1);
        updatedTabs.splice(toIndex, 0, movedTab);
        set({ openTabs: updatedTabs });
    },

    syncDisplayName: (path: string, title: string) => updateDisplayName(set, path, title),

    getDisplayName: (path: string) => {
        const state = get();
        return state.displayNames.get(path) || path.split('/').pop()?.replace('.md', '') || 'Untitled';
    },
});
