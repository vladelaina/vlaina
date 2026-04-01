import type { UploadResult } from '@/lib/assets/types';
import type { NotesStore } from '@/stores/notes/useNotesStore';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import type { EditorView } from '@milkdown/kit/prose/view';

type ImageUploadStoreState = Pick<NotesStore, 'uploadAsset' | 'currentNote'>;

export function extractImageFilesFromClipboardItems(
    items: Iterable<{ type: string; getAsFile: () => File | null }> | null | undefined,
): File[] {
    if (!items) return [];

    const imageFiles: File[] = [];
    for (const item of items) {
        if (!item.type.startsWith('image/')) continue;
        const file = item.getAsFile();
        if (file) {
            imageFiles.push(file);
        }
    }

    return imageFiles;
}

export function extractImageFilesFromFileList(
    files: Iterable<File> | ArrayLike<File> | null | undefined,
): File[] {
    if (!files) return [];
    return Array.from(files).filter((file) => file.type.startsWith('image/'));
}

export function buildImageNodeAttrs(src: string) {
    const fileName = src.split('/').pop() || src;
    const alt = fileName.replace(/\.[^/.]+$/, '');

    return {
        src,
        alt,
        align: 'center' as const,
        width: null,
    };
}

export function insertImageNodeAtSelection(view: EditorView, src: string): boolean {
    const imageNodeType = view.state.schema.nodes.image;
    if (!imageNodeType) {
        console.error('[ImageUpload] Image node type not found in schema');
        return false;
    }

    const imageNode = imageNodeType.create(buildImageNodeAttrs(src));
    const pos = view.state.selection.from;
    view.dispatch(view.state.tr.insert(pos, imageNode));
    return true;
}

export async function uploadImageFile(
    file: File,
    storeState: ImageUploadStoreState,
): Promise<UploadResult> {
    return storeState.uploadAsset(file, 'content', storeState.currentNote?.path);
}

export async function uploadImageFileAndInsert(
    file: File,
    view: EditorView,
    getStoreState: () => ImageUploadStoreState = useNotesStore.getState,
): Promise<boolean> {
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

export async function uploadImagesAndInsert(
    files: readonly File[],
    view: EditorView,
    getStoreState: () => ImageUploadStoreState = useNotesStore.getState,
): Promise<boolean> {
    let handled = false;

    for (const file of files) {
        const inserted = await uploadImageFileAndInsert(file, view, getStoreState);
        handled = inserted || handled;
    }

    return handled;
}
