import { getParentPath, isAbsolutePath, joinPath } from '@/lib/storage/adapter';

interface ResolveImageSourcePathOptions {
    rawSrc: string;
    notesPath: string;
    currentNotePath?: string;
}

export function getImageSourceBase(rawSrc: string): string {
    return rawSrc.split('#')[0] ?? '';
}

export function isVirtualImageSource(src: string): boolean {
    return (
        src.startsWith('http://') ||
        src.startsWith('https://') ||
        src.startsWith('data:') ||
        src.startsWith('blob:') ||
        src.startsWith('asset:')
    );
}

export async function resolveImageSourcePath({
    rawSrc,
    notesPath,
    currentNotePath,
}: ResolveImageSourcePathOptions): Promise<string> {
    const baseSrc = getImageSourceBase(rawSrc);

    if (!baseSrc || isVirtualImageSource(baseSrc)) {
        return '';
    }

    if (isAbsolutePath(baseSrc)) {
        return baseSrc;
    }

    if (!notesPath) {
        return '';
    }

    if (!currentNotePath) {
        return await joinPath(notesPath, baseSrc);
    }

    const absoluteNotePath = isAbsolutePath(currentNotePath)
        ? currentNotePath
        : await joinPath(notesPath, currentNotePath);
    const parentDir = getParentPath(absoluteNotePath) || notesPath;

    return await joinPath(parentDir, baseSrc);
}
