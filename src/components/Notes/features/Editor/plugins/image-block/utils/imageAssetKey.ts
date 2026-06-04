import { getNoteInternalImageAssetPath } from '@/lib/notes/markdown/urlSecurity';

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

export function getImageAssetKey(src: unknown): string | null {
    if (typeof src !== 'string') return null;

    const trimmedSrc = src.trim();
    if (!trimmedSrc) return null;

    const baseSrc = trimmedSrc.split('#')[0] ?? '';
    if (!baseSrc || isRemoteOrVirtualAsset(baseSrc)) {
        return null;
    }

    if (/^img:/i.test(baseSrc)) {
        const assetPath = getNoteInternalImageAssetPath(baseSrc);
        if (!assetPath) return null;
        const localAssetPath = getLocalAssetPath(assetPath);
        return localAssetPath || null;
    }

    const localPath = getLocalAssetPath(baseSrc);
    return localPath || null;
}
