import { useState, useRef, useEffect, useCallback } from 'react';
import { loadImageAsBlob } from '@/lib/assets/imageLoader';
import { buildFullAssetPath } from '@/lib/assets/pathUtils';
import { isBuiltinCover, getBuiltinCoverUrl } from '@/lib/assets/builtinCovers';
import { loadImageWithDimensions } from './coverUtils';

interface UseCoverSourceProps {
    url: string | null;
    vaultPath: string;
    onUpdate: (url: string | null, x: number, y: number, h?: number, s?: number) => void;
}

export function useCoverSource({ url, vaultPath, onUpdate }: UseCoverSourceProps) {
    const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);
    const [previewSrc, setPreviewSrc] = useState<string | null>(null);
    const [isImageReady, setIsImageReady] = useState(false);

    // Track previous src to show during transition
    const prevSrcRef = useRef<string | null>(null);
    // Track previous url to detect "add new" vs "switch" scenarios
    const prevUrlRef = useRef<string | null>(null);
    // Track last resolved URL to avoid duplicate resolves
    const lastResolvedUrlRef = useRef<string | null>(null);
    // Cache image dimensions
    const cachedDimensionsRef = useRef<{ width: number; height: number } | null>(null);
    // Selection state tracking
    const isSelectingRef = useRef(false);

    // Reset image ready state when url changes
    useEffect(() => {
        // Switch cover: keep old src for transition
        if (prevUrlRef.current && resolvedSrc) {
            prevSrcRef.current = resolvedSrc;
        } else {
            // New/Remove: clear transition src
            prevSrcRef.current = null;
        }

        prevUrlRef.current = url;
        setIsImageReady(false);
        cachedDimensionsRef.current = null;
        lastResolvedUrlRef.current = null;
    }, [url]);

    // Resolve URL to Blob
    useEffect(() => {
        async function resolve() {
            if (url === lastResolvedUrlRef.current && resolvedSrc) return;

            if (!url) {
                setResolvedSrc(null);
                setPreviewSrc(null);
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
                } catch {
                    setResolvedSrc(null);
                    setPreviewSrc(null);
                    isSelectingRef.current = false;
                    onUpdate(null, 50, 50);
                    return;
                }
            } else {
                return;
            }

            // Pre-load dimensions
            const dimensions = await loadImageWithDimensions(imageUrl);
            if (dimensions) {
                cachedDimensionsRef.current = dimensions;
            }

            setResolvedSrc(imageUrl);
            setPreviewSrc(null);
            isSelectingRef.current = false;
            lastResolvedUrlRef.current = url;
        }
        resolve();
    }, [url, vaultPath, onUpdate]);

    // Handle Image Load Event
    const handleImageLoad = useCallback(() => {
        setIsImageReady(true);
        prevSrcRef.current = null;
    }, []);

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
        prevSrcRef,
        isSelectingRef,
        cachedDimensionsRef,
        handleImageLoad,
    };
}
