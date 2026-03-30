import { remapMetadataEntries, saveNoteMetadata } from '../../storage';
import { getVaultStarredPaths, remapStarredEntriesForVault, saveStarredRegistry } from '../../starred';
import type { FileOperationContext, FolderRenameResult } from './operationTypes';

export async function processFolderRename(
    notesPath: string,
    path: string,
    newName: string,
    currentStore: FileOperationContext
): Promise<FolderRenameResult> {
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

    const updatedTabs = currentStore.openTabs.map((tab) => {
        if (tab.path.startsWith(`${path}/`)) {
            return { ...tab, path: tab.path.replace(path, newPath) };
        }
        return tab;
    });

    let updatedCurrentNote = currentStore.currentNote;
    if (updatedCurrentNote && updatedCurrentNote.path.startsWith(path + '/')) {
        const newNotePath = updatedCurrentNote.path.replace(path, newPath);
        updatedCurrentNote = { ...updatedCurrentNote, path: newNotePath };
    }

    const updatedMetadata = remapMetadataEntries(currentStore.noteMetadata ?? null, (relativePath) => {
        if (relativePath === path || relativePath.startsWith(path + '/')) {
            return relativePath.replace(path, newPath);
        }
        return relativePath;
    });

    if (updatedMetadata !== currentStore.noteMetadata && updatedMetadata) {
        saveNoteMetadata(notesPath, updatedMetadata);
    }

    return {
        newPath,
        updatedStarredEntries: starredResult.entries,
        updatedStarredFolders: starredPaths.folders,
        updatedStarredNotes: starredPaths.notes,
        updatedTabs,
        updatedCurrentNote,
        updatedMetadata,
    };
}
