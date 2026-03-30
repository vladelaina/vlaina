import { getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import { getVaultStarredPaths, remapStarredEntriesForVault, saveStarredRegistry } from '../../starred';
import { removeNodeFromTree } from '../../fileTreeUtils';
import { markExpectedExternalChange } from '../../document/externalChangeRegistry';
import { remapMetadataEntries } from '../../storage';
import type { DeleteOperationResult, FileOperationContext, FileOperationNextAction, NoteTabState } from './operationTypes';

export async function deleteNoteImpl(
    notesPath: string,
    path: string,
    currentStore: FileOperationContext
): Promise<DeleteOperationResult> {
    const storage = getStorageAdapter();
    const fullPath = await joinPath(notesPath, path);
    markExpectedExternalChange(fullPath);
    await storage.deleteFile(fullPath);

    const { openTabs, starredEntries, currentNote, rootFolder, noteMetadata } = currentStore;

    const updatedTabs = openTabs.filter((tab) => tab.path !== path);
    
    const starredResult = remapStarredEntriesForVault(starredEntries, notesPath, (relativePath, kind) => {
        if (kind !== 'note') return relativePath;
        return relativePath === path ? null : relativePath;
    });
    const starredPaths = getVaultStarredPaths(starredResult.entries, notesPath);
    if (starredResult.changed) {
        void saveStarredRegistry(starredResult.entries);
    }

    let nextAction: FileOperationNextAction = null;

    if (currentNote?.path === path) {
        const lastTab = updatedTabs[updatedTabs.length - 1] as NoteTabState | undefined;
        if (lastTab) {
            nextAction = { type: 'open', path: lastTab.path };
        }
    }

    const updatedMetadata = remapMetadataEntries(noteMetadata ?? null, (relativePath) =>
        relativePath === path ? null : relativePath
    );

    const newChildren = rootFolder ? removeNodeFromTree(rootFolder.children, path) : [];

    return {
        updatedTabs,
        updatedStarredEntries: starredResult.entries,
        updatedStarredNotes: starredPaths.notes,
        updatedStarredFolders: starredPaths.folders,
        nextAction,
        updatedMetadata,
        newChildren
    };
}

export async function deleteFolderImpl(
    notesPath: string,
    path: string,
    currentStore: FileOperationContext
): Promise<DeleteOperationResult> {
    const storage = getStorageAdapter();
    const fullPath = await joinPath(notesPath, path);
    markExpectedExternalChange(fullPath, true);
    await storage.deleteDir(fullPath, true);

    const { openTabs, starredEntries, currentNote, rootFolder, noteMetadata } = currentStore;

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

    const updatedTabs = openTabs.filter((tab) => !tab.path.startsWith(path + '/') && tab.path !== path);

    let nextAction: FileOperationNextAction = null;
    if (currentNote && (currentNote.path === path || currentNote.path.startsWith(path + '/'))) {
        const lastTab = updatedTabs[updatedTabs.length - 1] as NoteTabState | undefined;
        if (lastTab) {
            nextAction = { type: 'open', path: lastTab.path };
        }
    }

    const updatedMetadata = remapMetadataEntries(noteMetadata ?? null, (relativePath) => {
        if (relativePath === path || relativePath.startsWith(path + '/')) {
            return null;
        }
        return relativePath;
    });

    const newChildren = rootFolder ? removeNodeFromTree(rootFolder.children, path) : [];

    return {
        updatedStarredEntries: starredResult.entries,
        updatedStarredFolders: starredPaths.folders,
        updatedStarredNotes: starredPaths.notes,
        updatedTabs,
        nextAction,
        updatedMetadata,
        newChildren
    };
}
