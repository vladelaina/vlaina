import { getParentPath, isAbsolutePath, joinPath } from '@/lib/storage/adapter';
import { normalizeContainedAssetPath } from '@/lib/assets/core/pathContainment';

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

function getLocalImageSourcePath(baseSrc: string): string {
    return baseSrc.split('?')[0] ?? '';
}

export function isVirtualImageSource(src: string): boolean {
    return (
        src.startsWith('http://') ||
        src.startsWith('https://') ||
        src.startsWith('data:') ||
        src.startsWith('blob:')
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

function resolveCurrentNoteAssetRoot(
    notesPath: string,
    currentNotePath: string | undefined,
    currentNoteDir: string | null,
    deps: ImageSourcePathDeps,
): string {
    if (currentNotePath && deps.isAbsolutePath(currentNotePath) && currentNoteDir) {
        if (notesPath && normalizeContainedAssetPath(currentNotePath, notesPath)) {
            return notesPath;
        }

        return currentNoteDir;
    }

    return notesPath || currentNoteDir || '';
}

export async function resolveImageSourcePath(
    options: ResolveImageSourcePathOptions,
    deps: ImageSourcePathDeps = defaultDeps,
): Promise<string | null> {
    const candidates = await resolveImageSourcePathCandidates(options, deps);
    return candidates[0] ?? null;
}

export async function resolveImageSourcePathCandidates(
    options: ResolveImageSourcePathOptions,
    deps: ImageSourcePathDeps = defaultDeps,
): Promise<string[]> {
    const { rawSrc, notesPath, currentNotePath } = options;
    const baseSrc = getImageSourceBase(rawSrc);
    if (!baseSrc) return [];

    if (isVirtualImageSource(baseSrc)) {
        return [baseSrc];
    }

    const localSrc = getLocalImageSourcePath(baseSrc);
    if (!localSrc || deps.isAbsolutePath(localSrc)) {
        return [];
    }

    const currentNoteDir = await resolveCurrentNoteDirectory(notesPath, currentNotePath, deps);
    const currentNoteAssetRoot = resolveCurrentNoteAssetRoot(notesPath, currentNotePath, currentNoteDir, deps);

    if (localSrc.startsWith('./') || localSrc.startsWith('../')) {
        if (currentNoteDir) {
            const candidate = normalizeContainedAssetPath(
                await deps.joinPath(currentNoteDir, localSrc),
                currentNoteAssetRoot,
            );
            return candidate ? [candidate] : [];
        }
        if (!notesPath) return [];
        const candidate = normalizeContainedAssetPath(await deps.joinPath(notesPath, localSrc), notesPath);
        return candidate ? [candidate] : [];
    }

    const candidates: string[] = [];

    if (currentNoteDir) {
        const noteRelativeCandidate = normalizeContainedAssetPath(
            await deps.joinPath(currentNoteDir, localSrc),
            currentNoteAssetRoot,
        );
        if (noteRelativeCandidate) {
            candidates.push(noteRelativeCandidate);
        }
    }

    if (notesPath) {
        const vaultPath = normalizeContainedAssetPath(await deps.joinPath(notesPath, localSrc), notesPath);
        if (vaultPath && !candidates.includes(vaultPath)) {
            candidates.push(vaultPath);
        }
    }

    return candidates;
}
