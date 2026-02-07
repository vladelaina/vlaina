import { getStorageAdapter, joinPath } from '@/lib/storage/adapter';
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
    const newFileName = sanitizedName.endsWith('.md') ? sanitizedName : `${sanitizedName}.md`;
    const newPath = dirPath ? `${dirPath}/${newFileName}` : newFileName;

    if (newPath === path) return null;

    const newFullPath = await joinPath(notesPath, newPath);
    await storage.rename(fullPath, newFullPath);

    // 1. Display Names
    moveDisplayName(set, path, newPath);
    updateDisplayName(set, newPath, sanitizedName.replace('.md', ''));

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
        tab.path === path ? { ...tab, path: newPath, name: sanitizedName } : tab
    );

    // 5. Tree
    const updatedChildren = rootFolder 
        ? updateFileNodePath(rootFolder.children, path, newPath, sanitizedName) 
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
    const fileName = sourcePath.split('/').pop() || '';
    const newPath = targetFolderPath ? `${targetFolderPath}/${fileName}` : fileName;
    const sourceFullPath = await joinPath(notesPath, sourcePath);
    const targetFullPath = await joinPath(notesPath, newPath);

    await storage.rename(sourceFullPath, targetFullPath);
    
    moveDisplayName(set, sourcePath, newPath);

    const { starredNotes, starredFolders, openTabs, currentNote, rootFolder } = currentStore;

    // 1. Favorites
    let favoritesChanged = false;
    const updatedStarredNotes = starredNotes.map((p: string) => {
        if (p === sourcePath || p.startsWith(sourcePath + '/')) {
            favoritesChanged = true;
            return p === sourcePath ? newPath : p.replace(sourcePath, newPath);
        }
        return p;
    });
    const updatedStarredFolders = starredFolders.map((p: string) => {
        if (p === sourcePath || p.startsWith(sourcePath + '/')) {
            favoritesChanged = true;
            return p === sourcePath ? newPath : p.replace(sourcePath, newPath);
        }
        return p;
    });

    if (favoritesChanged) {
        saveFavoritesToFile(notesPath, {
            notes: updatedStarredNotes,
            folders: updatedStarredFolders,
        });
    }

    // 2. Tabs
    const updatedTabs = openTabs.map((tab: any) =>
        tab.path === sourcePath ? { ...tab, path: newPath } : tab
    );

    // 3. Current Note
    let nextCurrentNote = currentNote;
    if (currentNote?.path === sourcePath) {
        nextCurrentNote = { ...currentNote, path: newPath };
    }

    // 4. Tree
    let newChildren = rootFolder ? rootFolder.children : [];
    if (rootFolder) {
        const nodeToMove = findNode(rootFolder.children, sourcePath);
        if (nodeToMove) {
            const nodeWithNewPath = deepUpdateNodePath(nodeToMove, sourcePath, newPath);
            const updatedNode = { ...nodeWithNewPath, name: fileName.replace('.md', '') };
            const childrenWithoutNode = removeNodeFromTree(rootFolder.children, sourcePath);
            newChildren = addNodeToTree(childrenWithoutNode, targetFolderPath, updatedNode);
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
