import { getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import { ensureMarkdownFileName, getNoteTitleFromPath, normalizeNotePathKey } from '@/lib/notes/displayName';
import { sanitizeFileName } from '../../noteUtils';
import { moveDisplayName, updateDisplayName } from '../../displayNameUtils';
import { saveFavoritesToFile, saveNoteMetadata } from '../../storage';
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

    // 1. Display Names
    moveDisplayName(set, path, newPath);
    updateDisplayName(set, newPath, nextDisplayName);

    // 2. Favorites
    const { starredNotes, starredFolders, noteMetadata, openTabs, rootFolder, currentNote } = currentStore;
    let updatedStarred = starredNotes;
    if (starredNotes.includes(path)) {
        updatedStarred = starredNotes.map((p: string) => (p === path ? newPath : p));
        saveFavoritesToFile(notesPath, { notes: updatedStarred, folders: starredFolders });
    }

    // 3. Metadata
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

    // 4. Tabs
    const updatedTabs = openTabs.map((tab: any) =>
        tab.path === path ? { ...tab, path: newPath, name: nextDisplayName } : tab
    );

    // 5. Tree
    const updatedChildren = rootFolder 
        ? updateFileNodePath(rootFolder.children, path, newPath, nextDisplayName) 
        : [];

    // 6. Current Note
    let nextCurrentNote = currentNote;
    if (currentNote?.path === path) {
        nextCurrentNote = { ...currentNote, path: newPath };
    }

    return {
        newPath,
        updatedStarred,
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

    const { starredNotes, starredFolders, openTabs, currentNote, rootFolder } = currentStore;

    // 1. Favorites
    const updatedStarredNotes = starredNotes.map((p: string) => remapPath(p));
    const updatedStarredFolders = starredFolders.map((p: string) => remapPath(p));
    const favoritesChanged =
        updatedStarredNotes.some((path: string, index: number) => path !== starredNotes[index]) ||
        updatedStarredFolders.some((path: string, index: number) => path !== starredFolders[index]);

    if (favoritesChanged) {
        saveFavoritesToFile(notesPath, {
            notes: updatedStarredNotes,
            folders: updatedStarredFolders,
        });
    }

    // 2. Tabs
    const updatedTabs = openTabs.map((tab: any) => {
        const nextPath = remapPath(tab.path);
        return nextPath === tab.path ? tab : { ...tab, path: nextPath };
    });

    // 3. Current Note
    let nextCurrentNote = currentNote;
    if (currentNote?.path) {
        const nextPath = remapPath(currentNote.path);
        if (nextPath !== currentNote.path) {
            nextCurrentNote = { ...currentNote, path: nextPath };
        }
    }

    // 4. Tree
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
        updatedStarredNotes,
        updatedStarredFolders,
        updatedTabs,
        nextCurrentNote,
        newChildren
    };
}
