import { getParentPath, isAbsolutePath, joinPath } from '@/lib/storage/adapter';

interface ImageSourcePathDeps {
    getParentPath: (path: string) => string | null;
    isAbsolutePath: (path: string) => boolean;
    joinPath: (...segments: string[]) => Promise<string>;
}

interface ResolveImageSourcePathOptions {
    rawSrc: string;
    notesPath: string;
    currentNotePath?: string;
}

const defaultDeps: ImageSourcePathDeps = {
    getParentPath,
    isAbsolutePath,
    joinPath,
};

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

async function resolveCurrentNoteDirectory(
    notesPath: string,
    currentNotePath: string | undefined,
    deps: ImageSourcePathDeps,
): Promise<string | null> {
    if (!currentNotePath) return null;

    const absoluteNotePath = deps.isAbsolutePath(currentNotePath)
        ? currentNotePath
        : notesPath
            ? await deps.joinPath(notesPath, currentNotePath)
            : currentNotePath;

    return deps.getParentPath(absoluteNotePath);
}

export async function resolveImageSourcePath(
    options: ResolveImageSourcePathOptions,
    deps: ImageSourcePathDeps = defaultDeps,
): Promise<string | null> {
    const { rawSrc, notesPath, currentNotePath } = options;
    const baseSrc = getImageSourceBase(rawSrc);
    if (!baseSrc) return null;

    if (isVirtualImageSource(baseSrc)) {
        return baseSrc;
    }

    if (deps.isAbsolutePath(baseSrc)) {
        return baseSrc;
    }

    const currentNoteDir = await resolveCurrentNoteDirectory(notesPath, currentNotePath, deps);

    if (baseSrc.startsWith('./') || baseSrc.startsWith('../')) {
        if (currentNoteDir) {
            return deps.joinPath(currentNoteDir, baseSrc);
        }
        return notesPath ? deps.joinPath(notesPath, baseSrc) : null;
    }

    if (currentNoteDir) {
        return deps.joinPath(currentNoteDir, baseSrc);
    }

    return notesPath ? deps.joinPath(notesPath, baseSrc) : null;
}
