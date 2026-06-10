import type { UploadResult } from '@/lib/assets/types';
import { translate } from '@/lib/i18n';
import type { NotesStore } from '@/stores/notes/useNotesStore';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import { useToastStore } from '@/stores/useToastStore';
import type { EditorView } from '@milkdown/kit/prose/view';
import { canInsertImageNodeAtSelection, insertImageNodeAtSelection } from './imageNodeInsertion';
import { MAX_IMAGE_UPLOAD_INPUT_FILES } from './imageFileExtraction';

export type ImageUploadStoreState = Pick<NotesStore, 'uploadAsset' | 'currentNote'>;

export async function uploadImageFile(
    file: File,
    storeState: ImageUploadStoreState,
): Promise<UploadResult> {
    return storeState.uploadAsset(file, storeState.currentNote?.path);
}

function isTransientMissingVaultUpload(result: UploadResult): boolean {
    return !result.success && result.error === 'Vault path is unavailable';
}

export async function uploadImageFileAndInsert(
    file: File,
    view: EditorView,
    getStoreState: () => ImageUploadStoreState = useNotesStore.getState,
): Promise<boolean> {
    if (!canInsertImageNodeAtSelection(view)) {
        useToastStore.getState().addToast(translate('editor.imageCannotInsertHere'), 'error');
        return false;
    }

    try {
        const storeState = getStoreState();
        const result = await uploadImageFile(file, storeState);
        if (!result.success || !result.path) {
            if (isTransientMissingVaultUpload(result)) {
                return false;
            }
            useToastStore.getState().addToast(result.error || translate('editor.imageUploadFailed'), 'error');
            return false;
        }

        const inserted = insertImageNodeAtSelection(view, result.path);
        if (!inserted) {
            useToastStore.getState().addToast(translate('editor.imageUploadedCannotInsert'), 'error');
        }
        return inserted;
    } catch (error) {
        useToastStore.getState().addToast(
            error instanceof Error ? error.message : translate('editor.imageUploadFailed'),
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
        useToastStore.getState().addToast(translate('editor.imageCannotInsertHere'), 'error');
        return false;
    }

    let handled = false;

    for (const file of files.slice(0, MAX_IMAGE_UPLOAD_INPUT_FILES)) {
        const inserted = await uploadImageFileAndInsert(file, view, getStoreState);
        handled = inserted || handled;
    }

    return handled;
}
