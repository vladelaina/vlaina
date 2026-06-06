export const MAX_IMAGE_UPLOAD_INPUT_FILES = 64;
export const MAX_IMAGE_UPLOAD_TRANSFER_ITEM_SCAN = 1024;

interface ImageClipboardItem {
    type: string;
    getAsFile: () => File | null;
}

function getArrayLikeLength(value: { length?: unknown } | null | undefined): number | null {
    if (typeof value?.length !== 'number' || !Number.isFinite(value.length) || value.length <= 0) {
        return null;
    }
    return Math.floor(value.length);
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
            if (!item?.type.startsWith('image/')) continue;
            const file = item.getAsFile();
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
        if (!item.type.startsWith('image/')) continue;
        const file = item.getAsFile();
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
            if (file?.type.startsWith('image/')) {
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
        if (file.type.startsWith('image/')) {
            imageFiles.push(file);
            if (imageFiles.length >= MAX_IMAGE_UPLOAD_INPUT_FILES) {
                break;
            }
        }
    }

    return imageFiles;
}
