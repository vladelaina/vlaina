import { useReducer, useRef, useEffect, useCallback } from 'react';
import { loadImageWithDimensions } from '../utils/coverUtils';
import { resolveCoverAssetUrl } from '../utils/resolveCoverAssetUrl';

interface UseCoverSourceProps {
    url: string | null;
    vaultPath: string;
}

interface CoverSourceState {
    resolvedSrc: string | null;
    previewSrc: string | null;
    isImageReady: boolean;
    isError: boolean;
    isSelectionCommitting: boolean;
}

type CoverSourceAction =
    | { type: 'preview-set'; src: string | null }
    | { type: 'selection-commit-start' }
    | { type: 'selection-commit-end' }
    | { type: 'image-ready-set'; ready: boolean }
    | { type: 'url-switch-reset' }
    | { type: 'source-clear' }
    | { type: 'resolve-error' }
    | { type: 'resolve-success'; imageUrl: string };

const initialCoverSourceState: CoverSourceState = {
    resolvedSrc: null,
    previewSrc: null,
    isImageReady: false,
    isError: false,
    isSelectionCommitting: false,
};

function coverSourceReducer(state: CoverSourceState, action: CoverSourceAction): CoverSourceState {
    switch (action.type) {
        case 'preview-set':
            return {
                ...state,
                previewSrc: action.src,
                isSelectionCommitting: action.src ? false : state.isSelectionCommitting,
            };
        case 'selection-commit-start':
            return {
                ...state,
                isSelectionCommitting: true,
            };
        case 'selection-commit-end':
            return {
                ...state,
                isSelectionCommitting: false,
            };
        case 'image-ready-set':
            return {
                ...state,
                isImageReady: action.ready,
            };
        case 'url-switch-reset':
            return {
                ...state,
                resolvedSrc: null,
                isImageReady: false,
                isError: false,
            };
        case 'source-clear':
            return {
                ...state,
                resolvedSrc: null,
                previewSrc: null,
                isError: false,
                isSelectionCommitting: false,
            };
        case 'resolve-error':
            return {
                ...state,
                resolvedSrc: null,
                previewSrc: null,
                isError: true,
                isSelectionCommitting: false,
            };
        case 'resolve-success':
            return {
                ...state,
                resolvedSrc: action.imageUrl,
                previewSrc: null,
                isError: false,
                isSelectionCommitting: false,
            };
        default:
            return state;
    }
}

export function useCoverSource({ url, vaultPath }: UseCoverSourceProps) {
    // Sync resolution is removed to avoid fragile synchronous path building.
    // We rely on the async effect for robustness.
    
    const [state, dispatch] = useReducer(coverSourceReducer, initialCoverSourceState);

    const prevSrcRef = useRef<string | null>(null);
    const prevUrlRef = useRef<string | null>(null);
    const lastResolvedKeyRef = useRef<string | null>(null);

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
    }, [state.resolvedSrc]);

    useEffect(() => {
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
        lastResolvedKeyRef.current = null;
    }, [url, state.previewSrc, state.resolvedSrc]);

    useEffect(() => {
        let ignore = false;
        async function resolve() {
            const resolveKey = `${vaultPath}::${url ?? ''}`;
            if (resolveKey === lastResolvedKeyRef.current && state.resolvedSrc) return;
            if (!url) {
                dispatch({ type: 'source-clear' });
                return;
            }

            let imageUrl: string;
            try {
                imageUrl = await resolveCoverAssetUrl({
                    assetPath: url,
                    vaultPath,
                    allowHttp: true,
                    localCategory: 'covers',
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
            dispatch({ type: 'resolve-success', imageUrl });
            lastResolvedKeyRef.current = resolveKey;
        }
        resolve();
        return () => { ignore = true; };
    }, [url, vaultPath, state.resolvedSrc]);

    return {
        resolvedSrc: state.resolvedSrc,
        previewSrc: state.previewSrc,
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
