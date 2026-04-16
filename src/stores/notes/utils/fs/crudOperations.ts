import { resolveUniquePath } from './pathOperations';
import { safeWriteTextFile, createEmptyMetadataFile, setNoteEntry, addToRecentNotes } from '../../storage';
import { addNodeToTree } from '../../fileTreeUtils';
import { getNoteTitleFromPath } from '@/lib/notes/displayName';
import { markExpectedExternalChange } from '../../document/externalChangeRegistry';
import { readNoteMetadataFromMarkdown, updateNoteMetadataInMarkdown } from '../../frontmatter';

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

    const now = Date.now();
    const initialMetadata = readNoteMetadataFromMarkdown(content);
    const { content: initialContent, metadata } = updateNoteMetadataInMarkdown(content, {
        createdAt: initialMetadata.createdAt ?? now,
        updatedAt: initialMetadata.updatedAt ?? now,
    });

    markExpectedExternalChange(fullPath);
    await safeWriteTextFile(fullPath, initialContent);

    const updatedMetadata = setNoteEntry(currentStore.noteMetadata ?? createEmptyMetadataFile(), relativePath, {
        ...metadata,
    });

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
        content: initialContent,
        updatedMetadata,
        newChildren,
        updatedRecent
    };
}
