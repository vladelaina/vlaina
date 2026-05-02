import { resolveUniquePath } from './pathOperations';
import { safeWriteTextFile, createEmptyMetadataFile, setNoteEntry, addToRecentNotes } from '../../storage';
import { addNodeToTree } from '../../fileTreeUtils';
import { getNoteTitleFromPath } from '@/lib/notes/displayName';
import { getStorageAdapter } from '@/lib/storage/adapter';
import { markExpectedExternalChange } from '../../document/externalChangeRegistry';
import { readNoteMetadataFromMarkdown, updateNoteMetadataInMarkdown } from '../../frontmatter';
import { normalizeSerializedMarkdownDocument } from '@/lib/notes/markdown/markdownSerializationUtils';

export async function createNoteImpl(
    notesPath: string,
    folderPath: string | undefined,
    name: string | undefined,
    content: string,
    currentStore: any
) {
    const adapter = getStorageAdapter();
    const { relativePath, fullPath, fileName } = await resolveUniquePath(
        notesPath, 
        folderPath, 
        name || 'Untitled', 
        false
    );

    if (folderPath) {
    }

    const normalizedContent = normalizeSerializedMarkdownDocument(content);
    const now = Date.now();
    const initialMetadata = readNoteMetadataFromMarkdown(normalizedContent);
    const { content: initialContent, metadata } = updateNoteMetadataInMarkdown(normalizedContent, {
        createdAt: initialMetadata.createdAt ?? now,
        updatedAt: initialMetadata.updatedAt ?? now,
    });

    markExpectedExternalChange(fullPath);
    await safeWriteTextFile(fullPath, initialContent);
    const fileInfo = await adapter.stat?.(fullPath);

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
        modifiedAt: fileInfo?.modifiedAt ?? null,
        updatedMetadata,
        newChildren,
        updatedRecent
    };
}
