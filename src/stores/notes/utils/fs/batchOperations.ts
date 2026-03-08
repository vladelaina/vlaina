import { moveDisplayName } from '../../displayNameUtils';
import { saveFavoritesToFile } from '../../storage';
import { getNoteTitleFromPath } from '@/lib/notes/displayName';

export function batchUpdateTabsOnRename(
    openTabs: { path: string; name: string; isDirty: boolean }[],
    oldPath: string,
    newPath: string
) {
    return openTabs.map(tab => {
        if (tab.path === oldPath) {
            return { ...tab, path: newPath, name: getNoteTitleFromPath(newPath) };
        }
        return tab;
    });
}

export function batchUpdateTabsOnFolderRename(
    openTabs: { path: string; name: string; isDirty: boolean }[],
    oldFolderPath: string,
    newFolderPath: string,
    set: any // Zustand setter to update display names
) {
    return openTabs.map(tab => {
        if (tab.path.startsWith(oldFolderPath + '/')) {
            const newTabPath = tab.path.replace(oldFolderPath, newFolderPath);
            moveDisplayName(set, tab.path, newTabPath);
            return { ...tab, path: newTabPath };
        }
        return tab;
    });
}

export function batchUpdateTabsOnMove(
    openTabs: { path: string; name: string; isDirty: boolean }[],
    sourcePath: string,
    newPath: string
) {
    return openTabs.map(tab => 
        tab.path === sourcePath ? { ...tab, path: newPath } : tab
    );
}

export async function processFolderRename(
    notesPath: string,
    path: string,
    newName: string,
    currentStore: any,
    set: any
) {
    const { starredFolders, starredNotes } = currentStore;
    
    // 1. Calculate Paths
    const dirPath = path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : '';
    const newPath = dirPath ? `${dirPath}/${newName}` : newName;
    
    // 2. Favorites Update
    let favoritesChanged = false;
    const updatedStarredFolders = starredFolders.map((p: string) => {
        if (p === path) { favoritesChanged = true; return newPath; }
        if (p.startsWith(path + '/')) { favoritesChanged = true; return p.replace(path, newPath); }
        return p;
    });
    
    const updatedStarredNotes = starredNotes.map((p: string) => {
        if (p.startsWith(path + '/')) { favoritesChanged = true; return p.replace(path, newPath); }
        return p;
    });

    if (favoritesChanged) {
        saveFavoritesToFile(notesPath, {
            notes: updatedStarredNotes,
            folders: updatedStarredFolders,
        });
    }

    // 3. Tabs Update
    const updatedTabs = batchUpdateTabsOnFolderRename(currentStore.openTabs, path, newPath, set);

    // 4. Current Note Update
    let updatedCurrentNote = currentStore.currentNote;
    if (updatedCurrentNote && updatedCurrentNote.path.startsWith(path + '/')) {
        const newNotePath = updatedCurrentNote.path.replace(path, newPath);
        moveDisplayName(set, updatedCurrentNote.path, newNotePath);
        updatedCurrentNote = { ...updatedCurrentNote, path: newNotePath };
    }

    return {
        newPath,
        updatedStarredFolders,
        updatedStarredNotes,
        updatedTabs,
        updatedCurrentNote
    };
}
