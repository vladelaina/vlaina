import { useReducer, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { loadImageWithDimensions } from '../utils/coverDimensionCache';
import {
    getCachedResolvedCoverAssetUrl,
    rememberDisplayedCoverAssetUrl,
    resolveCoverAssetUrl,
    shouldPreserveAssetAnimation,
} from '../utils/resolveCoverAssetUrl';
import { coverSourceReducer, initialCoverSourceState, type CoverSourceState } from './coverSourceState';
import { logNotesSplitDiagnostic } from '@/lib/diagnostics/notesSplitDiagnostics';

const COVER_DISPLAY_THUMBNAIL_MAX_EDGE_PX = 1280;

function getCoverResolveOptions({
    url,
    notesRootPath,
    currentNotePath,
}: {
    url: string;
    notesRootPath: string;
    currentNotePath?: string;
}) {
    const preserveAnimation = shouldPreserveAssetAnimation(url);
    return {
        assetPath: url,
        notesRootPath,
        currentNotePath,
        thumbnail: !preserveAnimation,
        thumbnailMaxEdgePx: preserveAnimation ? undefined : COVER_DISPLAY_THUMBNAIL_MAX_EDGE_PX,
        replayAnimated: preserveAnimation,
    };
}

function getCoverSourceKey({
    url,
    notesRootPath,
    currentNotePath,
}: {
    url: string | null;
    notesRootPath: string;
    currentNotePath?: string;
}) {
    if (!url) return null;
    return `${notesRootPath}\u0000${currentNotePath ?? ''}\u0000${url}`;
}

interface UseCoverSourceProps {
    url: string | null;
    notesRootPath: string;
    currentNotePath?: string;
}

export function useCoverSource({ url, notesRootPath, currentNotePath }: UseCoverSourceProps) {
    const [state, dispatch] = useReducer(
        coverSourceReducer,
        { url, notesRootPath, currentNotePath },
        (initial): CoverSourceState => {
            if (!initial.url) {
                return initialCoverSourceState;
            }

            const resolveOptions = getCoverResolveOptions({
                url: initial.url,
                notesRootPath: initial.notesRootPath,
                currentNotePath: initial.currentNotePath,
            });
            const resolvedSrc = getCachedResolvedCoverAssetUrl(resolveOptions);
            const sourceKey = getCoverSourceKey({
                url: initial.url,
                notesRootPath: initial.notesRootPath,
                currentNotePath: initial.currentNotePath,
            });
            if (!resolvedSrc) {
                return initialCoverSourceState;
            }

            return {
                ...initialCoverSourceState,
                resolvedSrc,
                resolvedAssetPath: initial.url,
                resolvedSourceKey: sourceKey,
            };
        },
    );

    const prevSrcRef = useRef<string | null>(null);
    const previousSourceRef = useRef<{
        sourceKey: string | null;
        notesRootPath: string;
        currentNotePath?: string;
    }>({
        sourceKey: getCoverSourceKey({ url, notesRootPath, currentNotePath }),
        notesRootPath,
        currentNotePath,
    });

    const currentSourceKey = getCoverSourceKey({ url, notesRootPath, currentNotePath });
    const cachedResolvedSrc = url && currentSourceKey && state.resolvedSourceKey !== currentSourceKey
        ? getCachedResolvedCoverAssetUrl(getCoverResolveOptions({ url, notesRootPath, currentNotePath }))
        : null;
    const hasCurrentResolvedSrc = state.resolvedSourceKey === currentSourceKey;
    const isResolvedSourceStale = Boolean(
        url &&
        state.resolvedSourceKey &&
        !hasCurrentResolvedSrc &&
        !cachedResolvedSrc
    );
    const resolvedSrc = hasCurrentResolvedSrc ? state.resolvedSrc : cachedResolvedSrc;
    const previousSource = previousSourceRef.current;
    const canUsePreviousSource = Boolean(
        url &&
        prevSrcRef.current &&
        previousSource.notesRootPath === notesRootPath &&
        previousSource.currentNotePath === currentNotePath
    );

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
        if (!resolvedSrc) return;
        prevSrcRef.current = resolvedSrc;
    }, [resolvedSrc]);

    useEffect(() => {
        if (!url || !resolvedSrc) return;
        rememberDisplayedCoverAssetUrl(
            getCoverResolveOptions({ url, notesRootPath, currentNotePath }),
            resolvedSrc
        );
    }, [currentNotePath, notesRootPath, resolvedSrc, url]);

    useLayoutEffect(() => {
        if (currentSourceKey === previousSourceRef.current.sourceKey) return;

        const sameNoteContext = Boolean(
            url &&
            previousSourceRef.current.notesRootPath === notesRootPath &&
            previousSourceRef.current.currentNotePath === currentNotePath
        );
        if (sameNoteContext) {
            const fallbackSrc = state.previewSrc || resolvedSrc || prevSrcRef.current;
            if (fallbackSrc) {
                prevSrcRef.current = fallbackSrc;
            }
        } else {
            prevSrcRef.current = null;
        }

        previousSourceRef.current = {
            sourceKey: currentSourceKey,
            notesRootPath,
            currentNotePath,
        };

        if (url && currentSourceKey) {
            const cachedResolvedSrc = getCachedResolvedCoverAssetUrl(
                getCoverResolveOptions({ url, notesRootPath, currentNotePath })
            );
            if (cachedResolvedSrc) {
                prevSrcRef.current = cachedResolvedSrc;
                dispatch({
                    type: 'url-switch-resolved',
                    imageUrl: cachedResolvedSrc,
                    assetPath: url,
                    sourceKey: currentSourceKey,
                });
                return;
            }
        }

        dispatch({ type: 'url-switch-reset', preservePreview: sameNoteContext });
    }, [currentNotePath, currentSourceKey, notesRootPath, resolvedSrc, state.previewSrc, url]);

    useEffect(() => {
        let ignore = false;
        async function resolve() {
            if (!url) {
                dispatch({ type: 'source-clear' });
                return;
            }

            let imageUrl: string;
            try {
                const resolveOptions = getCoverResolveOptions({ url, notesRootPath, currentNotePath });
                imageUrl = await resolveCoverAssetUrl(resolveOptions);
            } catch {
                if (ignore) return;
                logNotesSplitDiagnostic('cover-source-resolve-error', {
                    currentNotePath: currentNotePath ?? null,
                    notesRootPath,
                    url,
                });
                dispatch({ type: 'resolve-error' });
                return;
            }
            if (ignore) return;
            const dimensions = await loadImageWithDimensions(imageUrl);
            if (ignore) return;
            if (!dimensions) {
                logNotesSplitDiagnostic('cover-source-dimension-error', {
                    currentNotePath: currentNotePath ?? null,
                    imageUrl,
                    notesRootPath,
                    url,
                });
                dispatch({ type: 'resolve-error' });
                return;
            }
            dispatch({
                type: 'resolve-success',
                imageUrl,
                assetPath: url,
                sourceKey: getCoverSourceKey({ url, notesRootPath, currentNotePath }) ?? url,
            });
        }
        resolve();
        return () => {
            ignore = true;
        };
    }, [url, notesRootPath, currentNotePath]);

    return {
        resolvedSrc,
        previewSrc: state.previewSrc,
        isResolvedSourceStale,
        canUsePreviousSource,
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
