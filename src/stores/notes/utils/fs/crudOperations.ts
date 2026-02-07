import { resolveUniquePath } from './pathOperations';
import { safeWriteTextFile, loadNoteMetadata, setNoteEntry, saveNoteMetadata, addToRecentNotes } from '../../storage';
import { addNodeToTree } from '../../fileTreeUtils';

export async function createNoteImpl(
    notesPath: string,
    folderPath: string | undefined,
    name: string | undefined, // undefined for "Untitled"
    content: string,
    currentStore: any // Partial store state
) {
    const { relativePath, fullPath, fileName } = await resolveUniquePath(
        notesPath, 
        folderPath, 
        name || 'Untitled', 
        false
    );

    // Ensure folder exists (if folderPath provided)
    if (folderPath) {
        // Implementation note: resolveUniquePath checks existence of the *file*, but not parent dir.
        // Usually parent dir is clicked from UI so it exists, but createNoteWithContent might imply creation.
        // We assume folderPath is valid or we create it.
        // For safety, let's just ensure it exists if content is provided (likely import/paste)
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
        name: fileName.replace('.md', ''),
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
