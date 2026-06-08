import { hasInternalNoteAssetUrlPathSegment } from '@/lib/assets/core/internalAssetPaths';
import { getNoteInternalImageAssetPath, sanitizeNoteMediaSrc } from '@/lib/notes/markdown/urlSecurity';

function isRemoteOrVirtualAsset(path: string): boolean {
    const normalized = path.toLowerCase();
    return (
        normalized.startsWith('http://') ||
        normalized.startsWith('https://') ||
        normalized.startsWith('data:') ||
        normalized.startsWith('blob:') ||
        normalized.startsWith('asset:')
    );
}

function getLocalAssetPath(path: string): string {
    return path.split('?')[0] ?? '';
}

function normalizeLocalAssetKey(path: string): string | null {
    const localPath = getLocalAssetPath(path);
    if (!localPath || hasInternalNoteAssetUrlPathSegment(localPath)) {
        return null;
    }
    return localPath;
}

export function getImageAssetKey(src: unknown): string | null {
    if (typeof src !== 'string') return null;

    const trimmedSrc = src.trim();
    if (!trimmedSrc) return null;

    const baseSrc = trimmedSrc.split('#')[0] ?? '';
    const safeSrc = sanitizeNoteMediaSrc(baseSrc);
    if (!safeSrc || isRemoteOrVirtualAsset(safeSrc)) {
        return null;
    }

    if (/^img:/i.test(safeSrc)) {
        const assetPath = getNoteInternalImageAssetPath(safeSrc);
        if (!assetPath) return null;
        return normalizeLocalAssetKey(assetPath);
    }

    return normalizeLocalAssetKey(safeSrc);
}
