import { useState, useRef, useEffect } from 'react';
import { loadImageAsBlob } from '@/lib/assets/io/reader';
import { resolveSystemAssetPath } from '@/lib/assets/core/paths';
import { isBuiltinCover, getBuiltinCoverUrl } from '@/lib/assets/builtinCovers';
import { loadImageWithDimensions } from '../utils/coverUtils';
import { coverDebug } from '../utils/debug';

interface UseCoverSourceProps {
    url: string | null;
    vaultPath: string;
}

export function useCoverSource({ url, vaultPath }: UseCoverSourceProps) {
    // Sync resolution is removed to avoid fragile synchronous path building.
    // We rely on the async effect for robustness.
    
    const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);
    const [previewSrc, setPreviewSrc] = useState<string | null>(null);
    const [isImageReady, setIsImageReady] = useState(false);
    const [isError, setIsError] = useState(false);

    const prevSrcRef = useRef<string | null>(null);
    const prevUrlRef = useRef<string | null>(null);
    const lastResolvedKeyRef = useRef<string | null>(null);
    const isSelectingRef = useRef(false);

    useEffect(() => {
        if (!resolvedSrc) return;
        prevSrcRef.current = resolvedSrc;
    }, [resolvedSrc]);

    useEffect(() => {
        if (url === prevUrlRef.current) return;

        if (url) {
            const fallbackSrc = previewSrc || resolvedSrc || prevSrcRef.current;
            if (fallbackSrc) {
                prevSrcRef.current = fallbackSrc;
            }
        } else {
            prevSrcRef.current = null;
        }

        prevUrlRef.current = url;
        setResolvedSrc(null);
        setIsImageReady(false);
        setIsError(false);
        lastResolvedKeyRef.current = null;
        coverDebug('useCoverSource', 'source-switch', {
            nextUrl: url,
            fallbackSrc: prevSrcRef.current ? prevSrcRef.current.slice(0, 120) : null,
            hasPreview: Boolean(previewSrc),
            hasResolved: Boolean(resolvedSrc),
        });
    }, [url, previewSrc, resolvedSrc]);

    useEffect(() => {
        let ignore = false;
        async function resolve() {
            const resolveKey = `${vaultPath}::${url ?? ''}`;
            if (resolveKey === lastResolvedKeyRef.current && resolvedSrc) return;
            if (!url) {
                setResolvedSrc(null);
                setPreviewSrc(null);
                setIsError(false);
                isSelectingRef.current = false;
                coverDebug('useCoverSource', 'source-cleared');
                return;
            }

            let imageUrl: string;
            if (url.startsWith('http')) {
                imageUrl = url;
            } else if (isBuiltinCover(url)) {
                imageUrl = getBuiltinCoverUrl(url);
            } else if (vaultPath) {
                try {
                    // Use robust async path resolution
                    // Covers are system assets
                    const fullPath = await resolveSystemAssetPath(vaultPath, url, 'covers');
                    imageUrl = await loadImageAsBlob(fullPath);
                } catch (e) {
                    if (ignore) return;
                    setResolvedSrc(null);
                    setPreviewSrc(null);
                    setIsError(true);
                    isSelectingRef.current = false;
                    coverDebug('useCoverSource', 'resolve-failed', {
                        assetPath: url,
                        error: e instanceof Error ? e.message : String(e),
                    });
                    return;
                }
            } else {
                return;
            }
            if (ignore) return;
            const dimensions = await loadImageWithDimensions(imageUrl);
            if (ignore) return;
            if (!dimensions) {
                setResolvedSrc(null);
                setPreviewSrc(null);
                setIsError(true);
                isSelectingRef.current = false;
                coverDebug('useCoverSource', 'resolve-failed', {
                    url,
                    imageUrl: typeof imageUrl === 'string' ? imageUrl.slice(0, 120) : '',
                    error: 'invalid-image-dimensions',
                });
                return;
            }
            setResolvedSrc(imageUrl);
            setPreviewSrc(null);
            setIsError(false);
            isSelectingRef.current = false;
            lastResolvedKeyRef.current = resolveKey;
            coverDebug('useCoverSource', 'resolve-ready', {
                url,
                imageUrl: typeof imageUrl === 'string' ? imageUrl.slice(0, 120) : '',
                width: dimensions.width,
                height: dimensions.height,
                previewCleared: true,
            });
        }
        resolve();
        return () => { ignore = true; };
    }, [url, vaultPath, resolvedSrc]);

    return {
        resolvedSrc,
        previewSrc,
        setPreviewSrc,
        isImageReady,
        setIsImageReady,
        isError,
        prevSrcRef,
        isSelectingRef
    };
}
