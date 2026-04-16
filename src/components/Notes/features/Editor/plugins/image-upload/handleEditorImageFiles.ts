import type { UploadResult } from '@/lib/assets/types';
import type { NotesStore } from '@/stores/notes/useNotesStore';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import type { EditorView } from '@milkdown/kit/prose/view';
import { canInsertImageNodeAtSelection, insertImageNodeAtSelection } from './imageNodeInsertion';

export type ImageUploadStoreState = Pick<NotesStore, 'uploadAsset' | 'currentNote'>;

export async function uploadImageFile(
    file: File,
    storeState: ImageUploadStoreState,
): Promise<UploadResult> {
    return storeState.uploadAsset(file, storeState.currentNote?.path);
}

export async function uploadImageFileAndInsert(
    file: File,
    view: EditorView,
    getStoreState: () => ImageUploadStoreState = useNotesStore.getState,
): Promise<boolean> {
    if (!canInsertImageNodeAtSelection(view)) {
        return false;
    }

    try {
        const result = await uploadImageFile(file, getStoreState());
        if (!result.success || !result.path) {
            console.error('[ImageUpload] Upload failed:', result.error);
            return false;
        }

        return insertImageNodeAtSelection(view, result.path);
    } catch (error) {
        console.error('[ImageUpload] Error during upload:', error);
        return false;
    }
}

export async function handleEditorImageFiles(
    files: readonly File[],
    view: EditorView,
    getStoreState: () => ImageUploadStoreState = useNotesStore.getState,
): Promise<boolean> {
    if (files.length === 0 || !canInsertImageNodeAtSelection(view)) {
        return false;
    }

    let handled = false;

    for (const file of files) {
        const inserted = await uploadImageFileAndInsert(file, view, getStoreState);
        handled = inserted || handled;
    }

    return handled;
}
