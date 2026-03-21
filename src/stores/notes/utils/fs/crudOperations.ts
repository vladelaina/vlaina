import { resolveUniquePath } from './pathOperations';
import { safeWriteTextFile, loadNoteMetadata, setNoteEntry, saveNoteMetadata, addToRecentNotes } from '../../storage';
import { addNodeToTree } from '../../fileTreeUtils';
import { getNoteTitleFromPath } from '@/lib/notes/displayName';

export async function createNoteImpl(
    notesPath: string,
    folderPath: string | undefined,
    name: string | undefined,
    content: string,
    currentStore: any
) {
    const { relativePath, fullPath, fileName } = await resolveUniquePath(
        notesPath, 
        folderPath, 
        name || 'Untitled', 
        false
    );

    if (folderPath) {
    }

    await safeWriteTextFile(fullPath, content);

    const now = Date.now();
    const metadata = await loadNoteMetadata(notesPath);
    const updatedMetadata = setNoteEntry(metadata, relativePath, {
        createdAt: now,
        updatedAt: now,
    });
    await saveNoteMetadata(notesPath, updatedMetadata);

    const newNode = {
        id: relativePath,
        name: getNoteTitleFromPath(fileName),
        path: relativePath,
        isFolder: false as const
    };

    const newChildren = currentStore.rootFolder 
        ? addNodeToTree(currentStore.rootFolder.children, folderPath, newNode)
        : [];

    const updatedRecent = addToRecentNotes(relativePath, currentStore.recentNotes);

    return {
        relativePath,
        fileName,
        updatedMetadata,
        newChildren,
        updatedRecent
    };
}
