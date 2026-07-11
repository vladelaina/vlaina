import { useCallback, useEffect, useMemo, useRef } from 'react';
import { flushSync } from 'react-dom';
import { DEFAULT_POSITION_PERCENT, DEFAULT_SCALE } from '../../../../utils/coverConstants';
import { loadImageWithDimensions } from '../../../../utils/coverDimensionCache';
import { getCoverResolveOptions, useCoverSource } from '../../../../hooks/useCoverSource';
import { resolveCoverAssetUrl } from '../../../../utils/resolveCoverAssetUrl';
import { resolveCoverFlowPhase } from './coverSelectionPhase';
import { useUIStore } from '@/stores/uiSlice';

interface UseCoverSelectionFlowOptions {
  url: string | null;
  coverHeight?: number;
  notesRootPath: string;
  currentNotePath?: string;
  onUpdate: (url: string | null, positionX: number, positionY: number, height?: number, scale?: number) => void;
  setShowPicker: (open: boolean) => void;
}

export const MAX_PENDING_COVER_PREVIEW_REQUESTS = 50;

function buildPreviewScope(notesRootPath: string, currentNotePath?: string) {
  return `${notesRootPath}\0${currentNotePath ?? ''}`;
}

function buildPreviewIdentity(scope: string, assetPath: string) {
  return `${scope}\0${assetPath}`;
}

export function useCoverSelectionFlow({
  url,
  coverHeight,
  notesRootPath,
  currentNotePath,
  onUpdate,
  setShowPicker,
}: UseCoverSelectionFlowOptions) {
  const setUniversalPreview = useUIStore((state) => state.setUniversalPreview);
  const {
    resolvedSrc,
    previewSrc,
    isResolvedSourceStale,
    canUsePreviousSource,
    setPreviewSrc,
    isImageReady,
    setIsImageReady,
    isError,
    isSelectionCommitting,
    beginSelectionCommit,
    endSelectionCommit,
    prevSrcRef,
  } = useCoverSource({ url, notesRootPath, currentNotePath });

  const phase = useMemo(() => resolveCoverFlowPhase({
    url,
    previewSrc,
    isError,
    isSelectionCommitting,
  }), [isError, isSelectionCommitting, previewSrc, url]);

  const previewScope = buildPreviewScope(notesRootPath, currentNotePath);
  const activePreviewScopeRef = useRef(previewScope);
  activePreviewScopeRef.current = previewScope;
  const lastPreviewIdentityRef = useRef<string | null>(null);
  const previewRequestRef = useRef(new Map<string, Promise<string | null>>());
  const commitCoverUpdate = useCallback((assetPath: string) => {
    flushSync(() => {
      onUpdate(assetPath, DEFAULT_POSITION_PERCENT, DEFAULT_POSITION_PERCENT, coverHeight, DEFAULT_SCALE);
    });
  }, [coverHeight, onUpdate]);

  const handleCoverSelect = useCallback((assetPath: string) => {
    const selectedIdentity = buildPreviewIdentity(previewScope, assetPath);
    const previewedIdentity = lastPreviewIdentityRef.current;
    lastPreviewIdentityRef.current = null;

    if (assetPath === url) {
      setPreviewSrc(null);
      endSelectionCommit();
      commitCoverUpdate(assetPath);
      setUniversalPreview(null, { cover: null });
      setShowPicker(false);
      return;
    }

    const shouldKeepPreview =
      Boolean(previewSrc) &&
      selectedIdentity === previewedIdentity;

    if (!shouldKeepPreview) {
      setPreviewSrc(null);
    }
    beginSelectionCommit();
    commitCoverUpdate(assetPath);
    setUniversalPreview(null, { cover: null });
    setShowPicker(false);
  }, [
    beginSelectionCommit,
    commitCoverUpdate,
    endSelectionCommit,
    previewScope,
    previewSrc,
    setPreviewSrc,
    setShowPicker,
    setUniversalPreview,
    url,
  ]);

  const handlePreview = useCallback(async (assetPath: string | null) => {
    if (assetPath) endSelectionCommit();

    if (!assetPath) {
      lastPreviewIdentityRef.current = null;
      setUniversalPreview(null, { cover: null });
      if (!isSelectionCommitting) setPreviewSrc(null);
      return;
    }

    setUniversalPreview(currentNotePath ?? null, { cover: assetPath, icon: null });

    const previewIdentity = buildPreviewIdentity(previewScope, assetPath);
    lastPreviewIdentityRef.current = previewIdentity;

    try {
      const requestKey = previewIdentity;
      let request = previewRequestRef.current.get(requestKey);
      if (!request) {
        if (previewRequestRef.current.size >= MAX_PENDING_COVER_PREVIEW_REQUESTS) {
          if (
            previewScope === activePreviewScopeRef.current
            && previewIdentity === lastPreviewIdentityRef.current
          ) setPreviewSrc(null);
          return;
        }
        request = (async () => {
          try {
            const imageUrl = await resolveCoverAssetUrl(getCoverResolveOptions({
              url: assetPath,
              notesRootPath,
              currentNotePath,
            }));
            const dimensions = await loadImageWithDimensions(imageUrl);
            return dimensions ? imageUrl : null;
          } finally {
            previewRequestRef.current.delete(requestKey);
          }
        })();
        previewRequestRef.current.set(requestKey, request);
      }

      const imageUrl = await request;
      if (!imageUrl) {
        if (
          previewScope === activePreviewScopeRef.current
          && previewIdentity === lastPreviewIdentityRef.current
        ) setPreviewSrc(null);
        return;
      }
      if (
        previewScope === activePreviewScopeRef.current
        && previewIdentity === lastPreviewIdentityRef.current
      ) {
        if (assetPath === url || imageUrl === resolvedSrc) {
          setPreviewSrc(null);
          return;
        }
        setPreviewSrc(imageUrl);
      }
    } catch {
      if (
        previewScope === activePreviewScopeRef.current
        && previewIdentity === lastPreviewIdentityRef.current
      ) setPreviewSrc(null);
    }
  }, [currentNotePath, endSelectionCommit, isSelectionCommitting, notesRootPath, previewScope, resolvedSrc, setPreviewSrc, setUniversalPreview, url]);

  const handlePickerClose = useCallback(() => {
    lastPreviewIdentityRef.current = null;
    setUniversalPreview(null, { cover: null });
    if (!isSelectionCommitting) {
      setPreviewSrc(null);
    }
    setShowPicker(false);
  }, [isSelectionCommitting, setPreviewSrc, setShowPicker, setUniversalPreview, url]);

  useEffect(() => {
    return () => {
      if (useUIStore.getState().universalPreviewTarget === currentNotePath) {
        setUniversalPreview(null, { cover: null });
      }
    };
  }, [currentNotePath, setUniversalPreview]);

  return {
    resolvedSrc,
    previewSrc,
    isResolvedSourceStale,
    canUsePreviousSource,
    isImageReady,
    setIsImageReady,
    isError,
    isSelectionCommitting,
    phase,
    prevSrcRef,
    handleCoverSelect,
    handlePreview,
    handlePickerClose,
  };
}
