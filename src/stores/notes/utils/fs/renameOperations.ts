import { getStorageAdapter } from '@/lib/storage/adapter';
import { normalizeNotePathKey } from '@/lib/notes/displayName';
import { assertValidFileName, sanitizeFileName } from '../../noteUtils';
import { findNode } from '../../fileTreeUtils';
import { resolveUniqueMovedPath, resolveUniqueRenamedPath } from './pathOperations';
import { markExpectedExternalChange } from '../../document/externalChangeRegistry';
import { emitNotesExternalPathRename } from '../../document/externalPathBroadcast';
import { normalizeVaultRelativePath, resolveVaultRelativeFullPath } from './vaultPathContainment';
import type { FileOperationContext, MoveItemResult, RenameNoteResult } from './operationTypes';

export async function renameNoteImpl(
    notesPath: string,
    path: string,
    newName: string
): Promise<RenameNoteResult | null> {
    const storage = getStorageAdapter();
    const { relativePath: safePath, fullPath } = await resolveVaultRelativeFullPath(notesPath, path);
    assertValidFileName(newName);
    const sanitizedName = sanitizeFileName(newName);
    const {
        relativePath: newPath,
        fullPath: newFullPath,
    } = await resolveUniqueRenamedPath(notesPath, safePath, sanitizedName, false);

    if (newPath === safePath) return null;

    markExpectedExternalChange(fullPath);
    markExpectedExternalChange(newFullPath);
    await storage.rename(fullPath, newFullPath);
    emitNotesExternalPathRename({ notesPath, oldPath: safePath, newPath });

    return {
        sourcePath: safePath,
        newPath,
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

    return {
        sourcePath: normalizedSourcePath,
        newPath,
        targetFolderPath: normalizedTargetFolderPath,
    };
}
