import { useReducer, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { loadImageWithDimensions } from '../utils/coverDimensionCache';
import { resolveCoverAssetUrl } from '../utils/resolveCoverAssetUrl';
import { coverSourceReducer, initialCoverSourceState } from './coverSourceState';

interface UseCoverSourceProps {
    url: string | null;
    vaultPath: string;
    currentNotePath?: string;
}

export function useCoverSource({ url, vaultPath, currentNotePath }: UseCoverSourceProps) {
    const [state, dispatch] = useReducer(coverSourceReducer, initialCoverSourceState);

    const prevSrcRef = useRef<string | null>(null);
    const prevUrlRef = useRef<string | null>(null);

    const setPreviewSrc = useCallback((src: string | null) => {
        dispatch({ type: 'preview-set', src });
    }, []);

    const beginSelectionCommit = useCallback(() => {
        dispatch({ type: 'selection-commit-start' });
    }, []);

    const endSelectionCommit = useCallback(() => {
        dispatch({ type: 'selection-commit-end' });
    }, []);

    const setIsImageReady = useCallback((ready: boolean) => {
        dispatch({ type: 'image-ready-set', ready });
    }, []);

    useEffect(() => {
        if (!state.resolvedSrc) return;
        prevSrcRef.current = state.resolvedSrc;
    }, [state.resolvedSrc, url]);

    useLayoutEffect(() => {
        if (url === prevUrlRef.current) return;

        if (url) {
            const fallbackSrc = state.previewSrc || state.resolvedSrc || prevSrcRef.current;
            if (fallbackSrc) {
                prevSrcRef.current = fallbackSrc;
            }
        } else {
            prevSrcRef.current = null;
        }

        prevUrlRef.current = url;
        dispatch({ type: 'url-switch-reset' });
    }, [url, state.previewSrc, state.resolvedSrc]);

    useEffect(() => {
        let ignore = false;
        async function resolve() {
            if (!url) {
                dispatch({ type: 'source-clear' });
                return;
            }

            let imageUrl: string;
            try {
                imageUrl = await resolveCoverAssetUrl({
                    assetPath: url,
                    vaultPath,
                    currentNotePath,
                });
            } catch {
                if (ignore) return;
                dispatch({ type: 'resolve-error' });
                return;
            }
            if (ignore) return;
            const dimensions = await loadImageWithDimensions(imageUrl);
            if (ignore) return;
            if (!dimensions) {
                dispatch({ type: 'resolve-error' });
                return;
            }
            dispatch({ type: 'resolve-success', imageUrl, assetPath: url });
        }
        resolve();
        return () => {
            ignore = true;
        };
    }, [url, vaultPath, currentNotePath]);

    const isResolvedSourceStale = Boolean(
        url &&
        state.resolvedAssetPath &&
        state.resolvedAssetPath !== url
    );

    return {
        resolvedSrc: state.resolvedSrc,
        previewSrc: state.previewSrc,
        isResolvedSourceStale,
        setPreviewSrc,
        isImageReady: state.isImageReady,
        setIsImageReady,
        isError: state.isError,
        isSelectionCommitting: state.isSelectionCommitting,
        beginSelectionCommit,
        endSelectionCommit,
        prevSrcRef,
    };
}
