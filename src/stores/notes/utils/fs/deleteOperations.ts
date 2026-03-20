import { getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import { removeDisplayName } from '../../displayNameUtils';
import { getVaultStarredPaths, remapStarredEntriesForVault, saveStarredRegistry } from '../../starred';
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

    const { openTabs, starredEntries, currentNote, rootFolder } = currentStore;

    const updatedTabs = openTabs.filter((t: any) => t.path !== path);
    
    removeDisplayName(set, path);

    const starredResult = remapStarredEntriesForVault(starredEntries, notesPath, (relativePath, kind) => {
        if (kind !== 'note') return relativePath;
        return relativePath === path ? null : relativePath;
    });
    const starredPaths = getVaultStarredPaths(starredResult.entries, notesPath);
    if (starredResult.changed) {
        void saveStarredRegistry(starredResult.entries);
    }

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

    const newChildren = rootFolder ? removeNodeFromTree(rootFolder.children, path) : [];

    return {
        updatedTabs,
        updatedStarredEntries: starredResult.entries,
        updatedStarredNotes: starredPaths.notes,
        updatedStarredFolders: starredPaths.folders,
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

    const { openTabs, starredEntries, currentNote, rootFolder } = currentStore;

    const starredResult = remapStarredEntriesForVault(starredEntries, notesPath, (relativePath) => {
        if (relativePath === path || relativePath.startsWith(path + '/')) {
            return null;
        }
        return relativePath;
    });
    const starredPaths = getVaultStarredPaths(starredResult.entries, notesPath);
    if (starredResult.changed) {
        void saveStarredRegistry(starredResult.entries);
    }

    const updatedTabs = openTabs.filter((tab: any) => !tab.path.startsWith(path + '/') && tab.path !== path);

    let updatedCurrentNote = currentNote;
    if (currentNote && (currentNote.path === path || currentNote.path.startsWith(path + '/'))) {
        if (updatedTabs.length > 0) {
            const lastTab = updatedTabs[updatedTabs.length - 1];
            openNoteCallback(lastTab.path);
            updatedCurrentNote = null;
        } else {
            updatedCurrentNote = null;
        }
    }

    removeDisplayName(set, path);

    const newChildren = rootFolder ? removeNodeFromTree(rootFolder.children, path) : [];

    return {
        updatedStarredEntries: starredResult.entries,
        updatedStarredFolders: starredPaths.folders,
        updatedStarredNotes: starredPaths.notes,
        updatedTabs,
        updatedCurrentNote,
        newChildren
    };
}
