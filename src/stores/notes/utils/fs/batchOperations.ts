import { moveDisplayName } from '../../displayNameUtils';
import { getVaultStarredPaths, remapStarredEntriesForVault, saveStarredRegistry } from '../../starred';
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
    set: any
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
    const { starredEntries } = currentStore;
    
    const dirPath = path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : '';
    const newPath = dirPath ? `${dirPath}/${newName}` : newName;
    
    const starredResult = remapStarredEntriesForVault(starredEntries, notesPath, (relativePath, kind) => {
        if (kind === 'folder' && relativePath === path) return newPath;
        if (relativePath.startsWith(path + '/')) return relativePath.replace(path, newPath);
        return relativePath;
    });
    const starredPaths = getVaultStarredPaths(starredResult.entries, notesPath);

    if (starredResult.changed) {
        void saveStarredRegistry(starredResult.entries);
    }

    const updatedTabs = batchUpdateTabsOnFolderRename(currentStore.openTabs, path, newPath, set);

    let updatedCurrentNote = currentStore.currentNote;
    if (updatedCurrentNote && updatedCurrentNote.path.startsWith(path + '/')) {
        const newNotePath = updatedCurrentNote.path.replace(path, newPath);
        moveDisplayName(set, updatedCurrentNote.path, newNotePath);
        updatedCurrentNote = { ...updatedCurrentNote, path: newNotePath };
    }

    return {
        newPath,
        updatedStarredEntries: starredResult.entries,
        updatedStarredFolders: starredPaths.folders,
        updatedStarredNotes: starredPaths.notes,
        updatedTabs,
        updatedCurrentNote
    };
}
