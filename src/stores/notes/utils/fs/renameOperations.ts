import { getStorageAdapter } from '@/lib/storage/adapter';
import { getNoteTitleFromPath, normalizeNotePathKey } from '@/lib/notes/displayName';
import { sanitizeFileName } from '../../noteUtils';
import { remapMetadataEntries } from '../../storage';
import { getVaultStarredPaths, remapStarredEntriesForVault, saveStarredRegistry } from '../../starred';
import { updateFileNodePath, findNode, deepUpdateNodePath, addNodeToTree, removeNodeFromTree } from '../../fileTreeUtils';
import { resolveUniqueMovedPath, resolveUniqueRenamedPath } from './pathOperations';
import { markExpectedExternalChange } from '../../document/externalChangeRegistry';
import { emitNotesExternalPathRename } from '../../document/externalPathBroadcast';
import { remapOpenTabsForExternalRename } from '../../document/externalPathSync';
import { normalizeVaultRelativePath, resolveVaultRelativeFullPath } from './vaultPathContainment';
import type { FileOperationContext, MoveItemResult, RenameNoteResult } from './operationTypes';

export async function renameNoteImpl(
    notesPath: string,
    path: string,
    newName: string,
    currentStore: FileOperationContext
): Promise<RenameNoteResult | null> {
    const storage = getStorageAdapter();
    const { relativePath: safePath, fullPath } = await resolveVaultRelativeFullPath(notesPath, path);
    const sanitizedName = sanitizeFileName(newName);
    const {
        relativePath: newPath,
        fullPath: newFullPath,
        fileName: newFileName,
    } = await resolveUniqueRenamedPath(notesPath, safePath, sanitizedName, false);
    const nextTitle = getNoteTitleFromPath(newFileName);

    if (newPath === safePath) return null;

    markExpectedExternalChange(fullPath);
    markExpectedExternalChange(newFullPath);
    await storage.rename(fullPath, newFullPath);
    emitNotesExternalPathRename({ notesPath, oldPath: safePath, newPath });

    const { starredEntries, noteMetadata, openTabs, rootFolder, currentNote } = currentStore;
    const starredResult = remapStarredEntriesForVault(starredEntries, notesPath, (relativePath, kind) => {
        if (kind !== 'note') return relativePath;
        return relativePath === safePath ? newPath : relativePath;
    });
    const starredPaths = getVaultStarredPaths(starredResult.entries, notesPath);
    if (starredResult.changed) {
        void saveStarredRegistry(starredResult.entries);
    }

    const updatedMetadata = remapMetadataEntries(noteMetadata, (relativePath) => {
        if (relativePath !== safePath) {
            return relativePath;
        }
        return newPath;
    });

    const updatedTabs = remapOpenTabsForExternalRename(openTabs, safePath, newPath);

    const updatedChildren = rootFolder
        ? updateFileNodePath(rootFolder.children, safePath, newPath, nextTitle)
        : [];

    let nextCurrentNote = currentNote;
    if (currentNote?.path === safePath) {
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
    currentStore: FileOperationContext
): Promise<MoveItemResult> {
    const storage = getStorageAdapter();
    const normalizedSourcePath = normalizeVaultRelativePath(normalizeNotePathKey(sourcePath) ?? sourcePath);
    const normalizedTargetFolderPath = normalizeVaultRelativePath(
        normalizeNotePathKey(targetFolderPath) ?? targetFolderPath,
        { allowEmpty: true },
    );
    if (!normalizedSourcePath || normalizedTargetFolderPath == null) {
        throw new Error('Path must stay inside the current vault.');
    }
    const sourcePathPrefix = `${normalizedSourcePath}/`;
    const sourceFullPath = (await resolveVaultRelativeFullPath(notesPath, normalizedSourcePath)).fullPath;
    const nodeToMove = currentStore.rootFolder
        ? findNode(currentStore.rootFolder.children, normalizedSourcePath)
        : null;
    const {
        relativePath: newPath,
        fullPath: targetFullPath,
    } = await resolveUniqueMovedPath(
        notesPath,
        normalizedSourcePath,
        normalizedTargetFolderPath || undefined,
        Boolean(nodeToMove?.isFolder)
    );

    markExpectedExternalChange(sourceFullPath, Boolean(nodeToMove?.isFolder));
    markExpectedExternalChange(targetFullPath, Boolean(nodeToMove?.isFolder));
    await storage.rename(sourceFullPath, targetFullPath);
    emitNotesExternalPathRename({ notesPath, oldPath: normalizedSourcePath, newPath });

    const remapPath = (value: string): string => {
        const normalized = normalizeNotePathKey(value) ?? value;
        if (normalized === normalizedSourcePath) return newPath;
        if (normalized.startsWith(sourcePathPrefix)) {
            return `${newPath}${normalized.slice(normalizedSourcePath.length)}`;
        }
        return value;
    };

    const { starredEntries, openTabs, currentNote, rootFolder, noteMetadata } = currentStore;

    const starredResult = remapStarredEntriesForVault(starredEntries, notesPath, (relativePath) => remapPath(relativePath));
    const starredPaths = getVaultStarredPaths(starredResult.entries, notesPath);

    if (starredResult.changed) {
        void saveStarredRegistry(starredResult.entries);
    }

    const updatedTabs = openTabs.map((tab) => {
        const nextPath = remapPath(tab.path);
        return nextPath === tab.path ? tab : { ...tab, path: nextPath };
    });

    const updatedMetadata = remapMetadataEntries(noteMetadata, (relativePath) => remapPath(relativePath));

    let nextCurrentNote = currentNote;
    if (currentNote?.path) {
        const nextPath = remapPath(currentNote.path);
        if (nextPath !== currentNote.path) {
            nextCurrentNote = { ...currentNote, path: nextPath };
        }
    }

    let newChildren = rootFolder ? rootFolder.children : [];
    if (rootFolder) {
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
        sourcePath: normalizedSourcePath,
        newPath,
        updatedStarredEntries: starredResult.entries,
        updatedStarredFolders: starredPaths.folders,
        updatedStarredNotes: starredPaths.notes,
        updatedMetadata,
        updatedTabs,
        nextCurrentNote,
        newChildren
    };
}
