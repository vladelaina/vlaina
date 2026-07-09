import { isImageFileLike } from '@/lib/assets/core/naming';

export const MAX_IMAGE_UPLOAD_INPUT_FILES = 64;
export const MAX_IMAGE_UPLOAD_TRANSFER_ITEM_SCAN = 1024;

interface ImageClipboardItem {
    kind?: string;
    type: string;
    getAsFile: () => File | null;
}

function getArrayLikeLength(value: { length?: unknown } | null | undefined): number | null {
    if (typeof value?.length !== 'number' || !Number.isFinite(value.length) || value.length <= 0) {
        return null;
    }
    return Math.floor(value.length);
}

function getImageFileFromClipboardItem(item: ImageClipboardItem | undefined): File | null {
    if (!item || (item.kind && item.kind !== 'file')) return null;

    const itemMimeType = item.type.split(';')[0]?.trim().toLowerCase() ?? '';
    if (itemMimeType.startsWith('image/')) {
        return item.getAsFile();
    }

    if (itemMimeType && itemMimeType !== 'application/octet-stream') {
        return null;
    }

    const file = item.getAsFile();
    if (!file) return null;

    return isImageFileLike(file) ? file : null;
}

export function extractImageFilesFromClipboardItems(
    items: Iterable<ImageClipboardItem> | ArrayLike<ImageClipboardItem> | null | undefined,
): File[] {
    if (!items) return [];

    const imageFiles: File[] = [];
    const arrayLikeLength = getArrayLikeLength(items as { length?: unknown });
    if (arrayLikeLength !== null) {
        const length = Math.min(arrayLikeLength, MAX_IMAGE_UPLOAD_TRANSFER_ITEM_SCAN);
        for (let index = 0; index < length; index += 1) {
            const item = (items as ArrayLike<ImageClipboardItem>)[index];
            const file = getImageFileFromClipboardItem(item);
            if (file) {
                imageFiles.push(file);
                if (imageFiles.length >= MAX_IMAGE_UPLOAD_INPUT_FILES) {
                    break;
                }
            }
        }
        return imageFiles;
    }

    let scanned = 0;
    for (const item of items as Iterable<ImageClipboardItem>) {
        if (scanned >= MAX_IMAGE_UPLOAD_TRANSFER_ITEM_SCAN) break;
        scanned += 1;
        const file = getImageFileFromClipboardItem(item);
        if (file) {
            imageFiles.push(file);
            if (imageFiles.length >= MAX_IMAGE_UPLOAD_INPUT_FILES) {
                break;
            }
        }
    }

    return imageFiles;
}

export function extractImageFilesFromFileList(
    files: Iterable<File> | ArrayLike<File> | null | undefined,
): File[] {
    if (!files) return [];

    const imageFiles: File[] = [];
    const arrayLikeLength = getArrayLikeLength(files as { length?: unknown });
    if (arrayLikeLength !== null) {
        const length = Math.min(arrayLikeLength, MAX_IMAGE_UPLOAD_TRANSFER_ITEM_SCAN);
        for (let index = 0; index < length; index += 1) {
            const file = (files as ArrayLike<File>)[index];
            if (file && isImageFileLike(file)) {
                imageFiles.push(file);
                if (imageFiles.length >= MAX_IMAGE_UPLOAD_INPUT_FILES) {
                    break;
                }
            }
        }
        return imageFiles;
    }

    let scanned = 0;
    for (const file of files as Iterable<File>) {
        if (scanned >= MAX_IMAGE_UPLOAD_TRANSFER_ITEM_SCAN) break;
        scanned += 1;
        if (isImageFileLike(file)) {
            imageFiles.push(file);
            if (imageFiles.length >= MAX_IMAGE_UPLOAD_INPUT_FILES) {
                break;
            }
        }
    }

    return imageFiles;
}
