import { parseImageSource } from './imageSourceFragment';

function isRemoteOrVirtualAsset(path: string): boolean {
    return (
        path.startsWith('http://') ||
        path.startsWith('https://') ||
        path.startsWith('data:') ||
        path.startsWith('blob:') ||
        path.startsWith('asset:')
    );
}

export function getImageAssetKey(src: unknown): string | null {
    if (typeof src !== 'string') return null;

    const trimmedSrc = src.trim();
    if (!trimmedSrc) return null;

    const baseSrc = parseImageSource(trimmedSrc).baseSrc || trimmedSrc.split('#')[0];
    if (!baseSrc || isRemoteOrVirtualAsset(baseSrc)) {
        return null;
    }

    return baseSrc;
}
