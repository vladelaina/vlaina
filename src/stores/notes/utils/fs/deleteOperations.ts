import { getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import { removeDisplayName } from '../../displayNameUtils';
import { saveFavoritesToFile } from '../../storage';
import { removeNodeFromTree } from '../../fileTreeUtils';

export async function deleteNoteImpl(
    notesPath: string,
    path: string,
    currentStore: any,
    set: any
) {
    const storage = getStorageAdapter();
    const fullPath = await joinPath(notesPath, path);
    await storage.deleteFile(fullPath);

    const { openTabs, starredNotes, starredFolders, currentNote, rootFolder } = currentStore;

    // 1. Tabs
    const updatedTabs = openTabs.filter((t: any) => t.path !== path);
    
    // 2. Display Name
    removeDisplayName(set, path);

    // 3. Favorites
    let updatedStarredNotes = starredNotes;
    if (starredNotes.includes(path)) {
        updatedStarredNotes = starredNotes.filter((p: string) => p !== path);
        saveFavoritesToFile(notesPath, { notes: updatedStarredNotes, folders: starredFolders });
    }

    // 4. Current Note & Navigation
    let nextCurrentNote = currentNote;
    let nextAction = null;

    if (currentNote?.path === path) {
        if (updatedTabs.length > 0) {
            const lastTab = updatedTabs[updatedTabs.length - 1];
            nextAction = { type: 'open', path: lastTab.path };
        } else {
            nextCurrentNote = null;
        }
    }

    // 5. Tree
    const newChildren = rootFolder ? removeNodeFromTree(rootFolder.children, path) : [];

    return {
        updatedTabs,
        updatedStarredNotes,
        nextCurrentNote,
        nextAction,
        newChildren
    };
}

export async function deleteFolderImpl(
    notesPath: string,
    path: string,
    currentStore: any,
    set: any,
    openNoteCallback: (path: string) => void
) {
    const storage = getStorageAdapter();
    const fullPath = await joinPath(notesPath, path);
    await storage.deleteDir(fullPath, true);

    const { openTabs, starredNotes, starredFolders, currentNote, rootFolder } = currentStore;

    // 1. Favorites
    const updatedStarredFolders = starredFolders.filter(
        (p: string) => p !== path && !p.startsWith(path + '/')
    );
    const updatedStarredNotes = starredNotes.filter((p: string) => !p.startsWith(path + '/'));

    if (
        updatedStarredFolders.length !== starredFolders.length ||
        updatedStarredNotes.length !== starredNotes.length
    ) {
        saveFavoritesToFile(notesPath, {
            notes: updatedStarredNotes,
            folders: updatedStarredFolders,
        });
    }

    // 2. Tabs
    const updatedTabs = openTabs.filter((tab: any) => !tab.path.startsWith(path + '/') && tab.path !== path);

    // 3. Current Note
    let updatedCurrentNote = currentNote;
    if (currentNote && (currentNote.path === path || currentNote.path.startsWith(path + '/'))) {
        if (updatedTabs.length > 0) {
            const lastTab = updatedTabs[updatedTabs.length - 1];
            openNoteCallback(lastTab.path);
            updatedCurrentNote = null; // Callback handles navigation
        } else {
            updatedCurrentNote = null;
        }
    }

    // 4. Display Names
    removeDisplayName(set, path);

    // 5. Tree
    const newChildren = rootFolder ? removeNodeFromTree(rootFolder.children, path) : [];

    return {
        updatedStarredFolders,
        updatedStarredNotes,
        updatedTabs,
        updatedCurrentNote,
        newChildren
    };
}
