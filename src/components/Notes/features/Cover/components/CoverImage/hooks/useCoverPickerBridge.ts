import { useCallback, useRef } from 'react';
import { loadImageAsBlob } from '@/lib/assets/io/reader';
import { resolveSystemAssetPath } from '@/lib/assets/core/paths';
import { isBuiltinCover, getBuiltinCoverUrl } from '@/lib/assets/builtinCovers';
import { loadImageWithDimensions } from '../../../utils/coverUtils';
import { coverDebug } from '../../../utils/debug';

interface UseCoverPickerBridgeOptions {
  url: string | null;
  coverHeight: number;
  vaultPath: string;
  onUpdate: (url: string | null, positionX: number, positionY: number, height?: number, scale?: number) => void;
  setPreviewSrc: (src: string | null) => void;
  isSelectingRef: React.MutableRefObject<boolean>;
  setShowPicker: (open: boolean) => void;
}

export function useCoverPickerBridge({
  url,
  coverHeight,
  vaultPath,
  onUpdate,
  setPreviewSrc,
  isSelectingRef,
  setShowPicker,
}: UseCoverPickerBridgeOptions) {
  const lastPreviewPathRef = useRef<string | null>(null);

  const handleCoverSelect = useCallback((assetPath: string) => {
    coverDebug('useCoverPickerBridge', 'select-cover', {
      currentUrl: url,
      nextAssetPath: assetPath,
    });

    if (assetPath === url) {
      setPreviewSrc(null);
      isSelectingRef.current = false;
      onUpdate(assetPath, 50, 50, coverHeight, 1);
      setShowPicker(false);
      coverDebug('useCoverPickerBridge', 'select-same-cover-commit', { assetPath });
      return;
    }

    isSelectingRef.current = true;
    onUpdate(assetPath, 50, 50, coverHeight, 1);
    setShowPicker(false);
    coverDebug('useCoverPickerBridge', 'select-new-cover-commit', {
      assetPath,
      coverHeight,
      commitPositionX: 50,
      commitPositionY: 50,
      commitScale: 1,
      hadPreviewSrc: Boolean(lastPreviewPathRef.current),
    });
  }, [url, setPreviewSrc, isSelectingRef, onUpdate, coverHeight, setShowPicker]);

  const handlePreview = useCallback(async (assetPath: string | null) => {
    lastPreviewPathRef.current = assetPath;
    if (assetPath) isSelectingRef.current = false;
    coverDebug('useCoverPickerBridge', 'preview-request', { assetPath });

    if (!assetPath) {
      if (!isSelectingRef.current) setPreviewSrc(null);
      coverDebug('useCoverPickerBridge', 'preview-cleared');
      return;
    }

    try {
      if (isBuiltinCover(assetPath)) {
        const builtinUrl = getBuiltinCoverUrl(assetPath);
        const dimensions = await loadImageWithDimensions(builtinUrl);
        if (!dimensions) {
          if (assetPath === lastPreviewPathRef.current) {
            setPreviewSrc(null);
          }
          coverDebug('useCoverPickerBridge', 'preview-builtin-dimensions-failed', {
            assetPath,
            builtinUrl,
          });
          return;
        }
        if (assetPath === lastPreviewPathRef.current) {
          setPreviewSrc(builtinUrl);
          coverDebug('useCoverPickerBridge', 'preview-builtin-ready', {
            assetPath,
            width: dimensions.width,
            height: dimensions.height,
          });
        }
        return;
      }
      if (!vaultPath) return;

      const category = assetPath.startsWith('icons/') ? 'icons' : 'covers';
      const fullPath = await resolveSystemAssetPath(vaultPath, assetPath, category);
      const blobUrl = await loadImageAsBlob(fullPath);
      const dimensions = await loadImageWithDimensions(blobUrl);
      if (!dimensions) {
        if (assetPath === lastPreviewPathRef.current) {
          setPreviewSrc(null);
        }
        coverDebug('useCoverPickerBridge', 'preview-local-dimensions-failed', {
          assetPath,
          fullPath,
        });
        return;
      }
      if (assetPath === lastPreviewPathRef.current) {
        setPreviewSrc(blobUrl);
        coverDebug('useCoverPickerBridge', 'preview-local-ready', {
          assetPath,
          fullPath,
          width: dimensions.width,
          height: dimensions.height,
        });
      }
    } catch (e) {
      if (assetPath === lastPreviewPathRef.current) {
        setPreviewSrc(null);
      }
      coverDebug('useCoverPickerBridge', 'preview-failed', {
        assetPath,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }, [isSelectingRef, setPreviewSrc, vaultPath]);

  const handlePickerClose = useCallback(() => {
    if (!isSelectingRef.current) {
      setPreviewSrc(null);
    }
    setShowPicker(false);
    coverDebug('useCoverPickerBridge', 'picker-closed', {
      isSelecting: isSelectingRef.current,
    });
  }, [isSelectingRef, setPreviewSrc, setShowPicker]);

  return {
    handleCoverSelect,
    handlePreview,
    handlePickerClose,
  };
}
