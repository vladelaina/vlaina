import { useState, useRef, useEffect } from 'react';
import { loadImageAsBlob, getCachedBlobUrl } from '@/lib/assets/imageLoader';
import { buildFullAssetPath } from '@/lib/assets/pathUtils';
import { isBuiltinCover, getBuiltinCoverUrl } from '@/lib/assets/builtinCovers';
import { loadImageWithDimensions, getCachedDimensions } from './coverUtils';

interface UseCoverSourceProps {
    url: string | null;
    vaultPath: string;
    onUpdate: (url: string | null, x: number, y: number, h?: number, s?: number) => void;
}

export function useCoverSource({ url, vaultPath, onUpdate }: UseCoverSourceProps) {
    // Helper to try resolving synchronously from cache
    const resolveSync = (targetUrl: string | null): [string | null, { width: number; height: number } | null] => {
        if (!targetUrl) return [null, null];

        if (targetUrl.startsWith('http')) return [targetUrl, null]; // External URLs not sync cached logic here yet
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

    // Initialize State
    const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);
    const [previewSrc, setPreviewSrc] = useState<string | null>(null);
    const [isImageReady, setIsImageReady] = useState(false);
    const [isError, setIsError] = useState(false);

    // Track previous state for transitions
    const prevSrcRef = useRef<string | null>(null);
    const prevUrlRef = useRef<string | null>(null); // To detect changes
    const lastResolvedUrlRef = useRef<string | null>(null);
    const cachedDimensionsRef = useRef<{ width: number; height: number } | null>(null);
    const isSelectingRef = useRef(false);

    // --- Synchronous "Derived State" Pattern for Instant Switching ---
    if (url !== prevUrlRef.current) {
        prevUrlRef.current = url;

        // Try sync resolve
        const [syncSrc, syncDims] = resolveSync(url);

        // Update State Immediately (during render phase) to prevent flash
        if (syncSrc && syncDims) {
            setResolvedSrc(syncSrc);
            setIsImageReady(true);
            setIsError(false);
            cachedDimensionsRef.current = syncDims;
            lastResolvedUrlRef.current = url;
            prevSrcRef.current = null;
        } else {
            // Not cached, enter loading state
            // Keep old src for transition
            if (resolvedSrc) prevSrcRef.current = resolvedSrc;
            setResolvedSrc(null);
            setIsImageReady(false);
            setIsError(false);
            cachedDimensionsRef.current = null;
            lastResolvedUrlRef.current = null;
        }
    }

    // Resolve URL to Blob
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
                    console.error("Failed to load cover image", e);
                    if (ignore) return;
                    setResolvedSrc(null);
                    setPreviewSrc(null);
                    setIsError(true);
                    isSelectingRef.current = false;
                    // Do NOT auto-delete the cover. Let the user see the error state.
                    // onUpdate(null, 50, 50); 
                    return;
                }
            } else {
                return;
            }

            if (ignore) return;

            // Pre-load dimensions
            const dimensions = await loadImageWithDimensions(imageUrl);

            if (ignore) return;

            if (!dimensions) {
                // Image failed to load (corrupt or 404)
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

        // Cleanup function to set ignore flag
        return () => {
            ignore = true;
        };
    }, [url, vaultPath, onUpdate]);

    // Manual ready check if preview matches resolved
    useEffect(() => {
        if (!resolvedSrc || isImageReady) return;
        // Logic handled by img.onLoad or checking complete property in parent
        // But since we can't access parent's imgRef easily here without passing it,
        // we might rely entirely on onLoad callback which is passed out.
    }, [resolvedSrc, isImageReady]);

    return {
        resolvedSrc,
        previewSrc,
        setPreviewSrc,
        isImageReady,
        setIsImageReady,
        isError,
        prevSrcRef,
        isSelectingRef,
        cachedDimensionsRef,
    };
}