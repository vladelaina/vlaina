function isRemoteOrVirtualAsset(path: string): boolean {
    return (
        path.startsWith('http://') ||
        path.startsWith('https://') ||
        path.startsWith('data:') ||
        path.startsWith('blob:') ||
        path.startsWith('asset:')
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

    const localPath = getLocalAssetPath(baseSrc);
    return localPath || null;
}
