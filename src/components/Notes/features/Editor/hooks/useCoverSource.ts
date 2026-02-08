import { useState, useRef, useEffect } from 'react';
import { loadImageAsBlob } from '@/lib/assets/io/reader';
import { resolveSystemAssetPath } from '@/lib/assets/core/paths';
import { isBuiltinCover, getBuiltinCoverUrl } from '@/lib/assets/builtinCovers';
import { loadImageWithDimensions } from './coverUtils';

interface UseCoverSourceProps {
    url: string | null;
    vaultPath: string;
    onUpdate: (url: string | null, x: number, y: number, h?: number, s?: number) => void;
}

export function useCoverSource({ url, vaultPath, onUpdate }: UseCoverSourceProps) {
    // Sync resolution is removed to avoid fragile synchronous path building.
    // We rely on the async effect for robustness.
    
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
        // Immediate reset for new URL
        setResolvedSrc(null);
        setIsImageReady(false);
        setIsError(false);
        cachedDimensionsRef.current = null;
        lastResolvedUrlRef.current = null;
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
