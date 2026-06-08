import { getParentPath, isAbsolutePath, joinPath } from '@/lib/storage/adapter';
import { normalizeContainedAssetPath } from '@/lib/assets/core/pathContainment';
import { hasInternalNoteAssetPathSegment } from '@/lib/assets/core/internalAssetPaths';
import {
    getNoteInternalImageAssetPath,
    normalizePublicRemoteMediaUrl,
    sanitizeNoteMediaSrc,
} from '@/lib/notes/markdown/urlSecurity';

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

export function getLocalImageSourcePath(baseSrc: string): string {
    const internalAssetPath = getNoteInternalImageAssetPath(baseSrc);
    if (internalAssetPath) {
        return (internalAssetPath.split('?')[0] ?? '').replace(/\\/g, '/');
    }
    if (/^img:/i.test(baseSrc)) {
        return '';
    }
    return (baseSrc.split('?')[0] ?? '').replace(/\\/g, '/');
}

export function isVirtualImageSource(src: string): boolean {
    const normalized = src.trim().toLowerCase();
    return (
        normalized.startsWith('http://') ||
        normalized.startsWith('https://') ||
        normalized.startsWith('data:') ||
        normalized.startsWith('blob:')
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

function addNonInternalCandidate(candidates: string[], candidate: string | null): void {
    if (!candidate || hasInternalNoteAssetPathSegment(candidate) || candidates.includes(candidate)) {
        return;
    }

    candidates.push(candidate);
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
    if (hasInternalNoteAssetPathSegment(currentNotePath)) {
        return [];
    }

    const baseSrc = getImageSourceBase(rawSrc);
    if (!baseSrc) return [];

    const safeBaseSrc = sanitizeNoteMediaSrc(baseSrc);
    if (!safeBaseSrc) return [];

    const normalizedRemoteSrc = normalizePublicRemoteMediaUrl(safeBaseSrc);
    if (normalizedRemoteSrc) {
        return [normalizedRemoteSrc];
    }

    if (isVirtualImageSource(safeBaseSrc)) {
        return [safeBaseSrc];
    }

    const localSrc = getLocalImageSourcePath(safeBaseSrc);
    if (!localSrc || deps.isAbsolutePath(localSrc) || hasInternalNoteAssetPathSegment(localSrc)) {
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
            return candidate && !hasInternalNoteAssetPathSegment(candidate) ? [candidate] : [];
        }
        if (!notesPath) return [];
        const candidate = normalizeContainedAssetPath(await deps.joinPath(notesPath, localSrc), notesPath);
        return candidate && !hasInternalNoteAssetPathSegment(candidate) ? [candidate] : [];
    }

    const candidates: string[] = [];

    if (currentNoteDir) {
        const noteRelativeCandidate = normalizeContainedAssetPath(
            await deps.joinPath(currentNoteDir, localSrc),
            currentNoteAssetRoot,
        );
        addNonInternalCandidate(candidates, noteRelativeCandidate);
    }

    if (notesPath) {
        const vaultPath = normalizeContainedAssetPath(await deps.joinPath(notesPath, localSrc), notesPath);
        addNonInternalCandidate(candidates, vaultPath);
    }

    return candidates;
}
