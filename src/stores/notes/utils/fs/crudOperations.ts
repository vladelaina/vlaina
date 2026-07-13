import { getParentPath, resolveUniquePath } from './pathOperations';
import {
    mergeNoteMetadataWithFileInfo,
    safeWriteTextFile,
    createEmptyMetadataFile,
    setNoteEntry,
} from '../../storage';
import { addNodeToTree } from '../../fileTreeUtils';
import { getNoteTitleFromPath } from '@/lib/notes/displayName';
import { getStorageAdapter } from '@/lib/storage/adapter';
import {
    clearExpectedExternalChange,
    markExpectedExternalChange,
} from '../../document/externalChangeRegistry';
import { readNoteMetadataFromMarkdown, updateNoteMetadataInMarkdown } from '../../frontmatter';
import { normalizeEditorStateMarkdownDocument } from '@/lib/notes/markdown/markdownSerializationUtils';
import { resolveNotesRootRelativeFullPath } from './notesRootPathContainment';

type CreatedNoteFileInfo = { modifiedAt?: number | null; size?: number | null } | null | undefined;

function getKnownCreatedNoteModifiedAt(fileInfo: CreatedNoteFileInfo): number | null {
    const modifiedAt = fileInfo?.modifiedAt;
    return typeof modifiedAt === 'number' && Number.isFinite(modifiedAt) ? modifiedAt : null;
}

function getKnownCreatedNoteSize(fileInfo: CreatedNoteFileInfo): number | null {
    const size = fileInfo?.size;
    return typeof size === 'number' && Number.isFinite(size) && size >= 0 ? size : null;
}

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
        const { fullPath: folderFullPath } = await resolveNotesRootRelativeFullPath(notesPath, folderPath, {
            allowEmpty: true,
            errorMessage: 'Target folder must stay inside the opened folder.',
        });
        await adapter.mkdir(folderFullPath, true);
    }

    const normalizedContent = normalizeEditorStateMarkdownDocument(content);
    const initialMetadata = readNoteMetadataFromMarkdown(normalizedContent);
    const { content: initialContent, metadata: frontmatterMetadata } =
        updateNoteMetadataInMarkdown(normalizedContent, initialMetadata);

    markExpectedExternalChange(fullPath);
    try {
        if (adapter.writeFileIfUnchanged) {
            const didCreate = await adapter.writeFileIfUnchanged(fullPath, null, initialContent);
            if (!didCreate) {
                throw new Error('Another vlaina window created this note first. Your draft is preserved; save it again.');
            }
        } else {
            await safeWriteTextFile(fullPath, initialContent);
        }
    } catch (error) {
        clearExpectedExternalChange(fullPath);
        throw error;
    }
    const fileInfo = await adapter.stat?.(fullPath);
    const metadata = mergeNoteMetadataWithFileInfo(frontmatterMetadata, fileInfo);

    const updatedMetadata = setNoteEntry(currentStore.noteMetadata ?? createEmptyMetadataFile(), relativePath, {
        ...metadata,
    });

    const newNode = {
        id: relativePath,
        name: getNoteTitleFromPath(fileName),
        path: relativePath,
        isFolder: false as const
    };

    const parentPath = getParentPath(relativePath) || undefined;
    const newChildren = currentStore.rootFolder
        ? addNodeToTree(currentStore.rootFolder.children, parentPath, newNode)
        : [];

    return {
        relativePath,
        fileName,
        content: initialContent,
        modifiedAt: getKnownCreatedNoteModifiedAt(fileInfo),
        size: getKnownCreatedNoteSize(fileInfo),
        updatedMetadata,
        newChildren,
    };
}
