import { normalizePublicRemoteMediaUrl } from '@/lib/notes/markdown/urlSecurity';
import { getImageSourceBase, isVirtualImageSource } from './imageSourcePath';

export function getImageViewerResourceSrc(baseSrc: string, resolvedSrc: string | null) {
    const baseResourceSrc = getImageSourceBase(baseSrc);
    const remoteResourceSrc = normalizePublicRemoteMediaUrl(baseResourceSrc);
    if (remoteResourceSrc) {
        return remoteResourceSrc;
    }
    if (baseResourceSrc && isVirtualImageSource(baseResourceSrc)) {
        return baseResourceSrc;
    }
    return resolvedSrc || baseResourceSrc;
}
