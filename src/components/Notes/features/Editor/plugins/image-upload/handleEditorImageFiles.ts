import type { UploadResult } from '@/lib/assets/types';
import type { NotesStore } from '@/stores/notes/useNotesStore';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import { useToastStore } from '@/stores/useToastStore';
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
        useToastStore.getState().addToast('Cannot insert image here', 'error');
        return false;
    }

    try {
        const result = await uploadImageFile(file, getStoreState());
        if (!result.success || !result.path) {
            console.error('[ImageUpload] Upload failed:', result.error);
            useToastStore.getState().addToast(result.error || 'Image upload failed', 'error');
            return false;
        }

        const inserted = insertImageNodeAtSelection(view, result.path);
        if (!inserted) {
            useToastStore.getState().addToast('Image uploaded, but could not be inserted here', 'error');
        }
        return inserted;
    } catch (error) {
        console.error('[ImageUpload] Error during upload:', error);
        useToastStore.getState().addToast(
            error instanceof Error ? error.message : 'Image upload failed',
            'error',
        );
        return false;
    }
}

export async function handleEditorImageFiles(
    files: readonly File[],
    view: EditorView,
    getStoreState: () => ImageUploadStoreState = useNotesStore.getState,
): Promise<boolean> {
    if (files.length === 0) {
        return false;
    }

    if (!canInsertImageNodeAtSelection(view)) {
        useToastStore.getState().addToast('Cannot insert image here', 'error');
        return false;
    }

    let handled = false;

    for (const file of files) {
        const inserted = await uploadImageFileAndInsert(file, view, getStoreState);
        handled = inserted || handled;
    }

    return handled;
}
