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
