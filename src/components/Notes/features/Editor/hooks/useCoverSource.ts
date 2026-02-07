import { useState, useRef, useEffect } from 'react';
import { loadImageAsBlob, getCachedBlobUrl } from '@/lib/assets/io/reader';
import { buildFullAssetPath } from '@/lib/assets/core/paths';
import { isBuiltinCover, getBuiltinCoverUrl } from '@/lib/assets/builtinCovers';
import { loadImageWithDimensions, getCachedDimensions } from './coverUtils';

interface UseCoverSourceProps {
    url: string | null;
    vaultPath: string;
    onUpdate: (url: string | null, x: number, y: number, h?: number, s?: number) => void;
}

export function useCoverSource({ url, vaultPath, onUpdate }: UseCoverSourceProps) {
    const resolveSync = (targetUrl: string | null): [string | null, { width: number; height: number } | null] => {
        if (!targetUrl) return [null, null];
        if (targetUrl.startsWith('http')) return [targetUrl, null];
        if (isBuiltinCover(targetUrl)) return [getBuiltinCoverUrl(targetUrl), { width: 1920, height: 1080 }];
        if (vaultPath) {
            try {
                const fullPath = buildFullAssetPath(vaultPath, targetUrl);
                const cachedBlob = getCachedBlobUrl(fullPath);
                if (cachedBlob) {
                    const cachedDims = getCachedDimensions(cachedBlob);
                    return [cachedBlob, cachedDims || null];
                }
            } catch {
                return [null, null];
            }
        }
        return [null, null];
    };

    const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);
    const [previewSrc, setPreviewSrc] = useState<string | null>(null);
    const [isImageReady, setIsImageReady] = useState(false);
    const [isError, setIsError] = useState(false);

    const prevSrcRef = useRef<string | null>(null);
    const prevUrlRef = useRef<string | null>(null);
    const lastResolvedUrlRef = useRef<string | null>(null);
    const cachedDimensionsRef = useRef<{ width: number; height: number } | null>(null);
    const isSelectingRef = useRef(false);

    if (url !== prevUrlRef.current) {
        prevUrlRef.current = url;
        const [syncSrc, syncDims] = resolveSync(url);
        if (syncSrc && syncDims) {
            setResolvedSrc(syncSrc);
            setIsImageReady(true);
            setIsError(false);
            cachedDimensionsRef.current = syncDims;
            lastResolvedUrlRef.current = url;
            prevSrcRef.current = null;
        } else {
            if (resolvedSrc) prevSrcRef.current = resolvedSrc;
            setResolvedSrc(null);
            setIsImageReady(false);
            setIsError(false);
            cachedDimensionsRef.current = null;
            lastResolvedUrlRef.current = null;
        }
    }

    useEffect(() => {
        let ignore = false;
        async function resolve() {
            if (url === lastResolvedUrlRef.current && resolvedSrc) return;
            if (!url) {
                setResolvedSrc(null);
                setPreviewSrc(null);
                setIsError(false);
                isSelectingRef.current = false;
                return;
            }
            let imageUrl: string;
            if (url.startsWith('http')) {
                imageUrl = url;
            } else if (isBuiltinCover(url)) {
                imageUrl = getBuiltinCoverUrl(url);
            } else if (vaultPath) {
                try {
                    const fullPath = buildFullAssetPath(vaultPath, url);
                    imageUrl = await loadImageAsBlob(fullPath);
                } catch (e) {
                    if (ignore) return;
                    setResolvedSrc(null);
                    setPreviewSrc(null);
                    setIsError(true);
                    isSelectingRef.current = false;
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
                return;
            }
            cachedDimensionsRef.current = dimensions;
            setResolvedSrc(imageUrl);
            setPreviewSrc(null);
            setIsError(false);
            isSelectingRef.current = false;
            lastResolvedUrlRef.current = url;
        }
        resolve();
        return () => { ignore = true; };
    }, [url, vaultPath, onUpdate]);

    return {
        resolvedSrc,
        previewSrc,
        setPreviewSrc,
        isImageReady,
        setIsImageReady,
        isError,
        prevSrcRef,
        isSelectingRef,
        cachedDimensionsRef
    };
}
