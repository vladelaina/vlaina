import { getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import { ensureMarkdownFileName, getNoteTitleFromPath, normalizeNotePathKey } from '@/lib/notes/displayName';
import { sanitizeFileName } from '../../noteUtils';
import { moveDisplayName, updateDisplayName } from '../../displayNameUtils';
import { saveNoteMetadata } from '../../storage';
import { getVaultStarredPaths, remapStarredEntriesForVault, saveStarredRegistry } from '../../starred';
import { updateFileNodePath, findNode, deepUpdateNodePath, addNodeToTree, removeNodeFromTree } from '../../fileTreeUtils';

export async function renameNoteImpl(
    notesPath: string,
    path: string,
    newName: string,
    currentStore: any,
    set: any
) {
    const storage = getStorageAdapter();
    const fullPath = await joinPath(notesPath, path);
    const dirPath = path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : '';
    const sanitizedName = sanitizeFileName(newName);
    const newFileName = ensureMarkdownFileName(sanitizedName);
    const nextDisplayName = getNoteTitleFromPath(newFileName);
    const newPath = dirPath ? `${dirPath}/${newFileName}` : newFileName;

    if (newPath === path) return null;

    const newFullPath = await joinPath(notesPath, newPath);
    await storage.rename(fullPath, newFullPath);

    moveDisplayName(set, path, newPath);
    updateDisplayName(set, newPath, nextDisplayName);

    const { starredEntries, noteMetadata, openTabs, rootFolder, currentNote } = currentStore;
    const starredResult = remapStarredEntriesForVault(starredEntries, notesPath, (relativePath, kind) => {
        if (kind !== 'note') return relativePath;
        return relativePath === path ? newPath : relativePath;
    });
    const starredPaths = getVaultStarredPaths(starredResult.entries, notesPath);
    if (starredResult.changed) {
        void saveStarredRegistry(starredResult.entries);
    }

    let updatedMetadata = noteMetadata;
    if (noteMetadata?.notes[path]) {
        const entry = noteMetadata.notes[path];
        const { [path]: _, ...restNotes } = noteMetadata.notes;
        updatedMetadata = {
            ...noteMetadata,
            notes: { ...restNotes, [newPath]: entry },
        };
        saveNoteMetadata(notesPath, updatedMetadata);
    }

    const updatedTabs = openTabs.map((tab: any) =>
        tab.path === path ? { ...tab, path: newPath, name: nextDisplayName } : tab
    );

    const updatedChildren = rootFolder 
        ? updateFileNodePath(rootFolder.children, path, newPath, nextDisplayName) 
        : [];

    let nextCurrentNote = currentNote;
    if (currentNote?.path === path) {
        nextCurrentNote = { ...currentNote, path: newPath };
    }

    return {
        newPath,
        updatedStarredEntries: starredResult.entries,
        updatedStarredNotes: starredPaths.notes,
        updatedStarredFolders: starredPaths.folders,
        updatedMetadata,
        updatedTabs,
        updatedChildren,
        nextCurrentNote
    };
}

export async function moveItemImpl(
    notesPath: string,
    sourcePath: string,
    targetFolderPath: string,
    currentStore: any,
    set: any
) {
    const storage = getStorageAdapter();
    const normalizedSourcePath = normalizeNotePathKey(sourcePath) ?? sourcePath;
    const normalizedTargetFolderPath = normalizeNotePathKey(targetFolderPath) ?? targetFolderPath;
    const fileName = normalizedSourcePath.split('/').pop() || '';
    const sourcePathPrefix = `${normalizedSourcePath}/`;
    const newPath = normalizedTargetFolderPath ? `${normalizedTargetFolderPath}/${fileName}` : fileName;
    const sourceFullPath = await joinPath(notesPath, normalizedSourcePath);
    const targetFullPath = await joinPath(notesPath, newPath);

    await storage.rename(sourceFullPath, targetFullPath);

    const remapPath = (value: string): string => {
        const normalized = normalizeNotePathKey(value) ?? value;
        if (normalized === normalizedSourcePath) return newPath;
        if (normalized.startsWith(sourcePathPrefix)) {
            return `${newPath}${normalized.slice(normalizedSourcePath.length)}`;
        }
        return value;
    };

    set((state: any) => {
        let changed = false;
        const updatedDisplayNames = new Map(state.displayNames);

        for (const [pathKey, displayName] of state.displayNames.entries()) {
            const nextPath = remapPath(pathKey);
            if (nextPath === pathKey) continue;
            updatedDisplayNames.delete(pathKey);
            updatedDisplayNames.set(nextPath, displayName);
            changed = true;
        }

        return changed ? { displayNames: updatedDisplayNames } : {};
    });

    const { starredEntries, openTabs, currentNote, rootFolder } = currentStore;

    const starredResult = remapStarredEntriesForVault(starredEntries, notesPath, (relativePath) => remapPath(relativePath));
    const starredPaths = getVaultStarredPaths(starredResult.entries, notesPath);

    if (starredResult.changed) {
        void saveStarredRegistry(starredResult.entries);
    }

    const updatedTabs = openTabs.map((tab: any) => {
        const nextPath = remapPath(tab.path);
        return nextPath === tab.path ? tab : { ...tab, path: nextPath };
    });

    let nextCurrentNote = currentNote;
    if (currentNote?.path) {
        const nextPath = remapPath(currentNote.path);
        if (nextPath !== currentNote.path) {
            nextCurrentNote = { ...currentNote, path: nextPath };
        }
    }

    let newChildren = rootFolder ? rootFolder.children : [];
    if (rootFolder) {
        const nodeToMove = findNode(rootFolder.children, normalizedSourcePath);
        if (nodeToMove) {
            const nodeWithNewPath = deepUpdateNodePath(nodeToMove, normalizedSourcePath, newPath);
            const updatedNode = nodeToMove.isFolder
                ? nodeWithNewPath
                : { ...nodeWithNewPath, name: getNoteTitleFromPath(newPath) };
            const childrenWithoutNode = removeNodeFromTree(rootFolder.children, normalizedSourcePath);
            newChildren = addNodeToTree(childrenWithoutNode, normalizedTargetFolderPath, updatedNode);
        }
    }

    return {
        updatedStarredEntries: starredResult.entries,
        updatedStarredFolders: starredPaths.folders,
        updatedStarredNotes: starredPaths.notes,
        updatedTabs,
        nextCurrentNote,
        newChildren
    };
}
