import { useCallback, useRef } from 'react';
import { loadImageAsBlob } from '@/lib/assets/io/reader';
import { resolveSystemAssetPath } from '@/lib/assets/core/paths';
import { isBuiltinCover, getBuiltinCoverUrl } from '@/lib/assets/builtinCovers';

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
    if (assetPath === url) {
      setPreviewSrc(null);
      isSelectingRef.current = false;
      onUpdate(assetPath, 50, 50, coverHeight, 1);
      setShowPicker(false);
      return;
    }

    isSelectingRef.current = true;
    onUpdate(assetPath, 50, 50, coverHeight, 1);
    setShowPicker(false);
  }, [url, setPreviewSrc, isSelectingRef, onUpdate, coverHeight, setShowPicker]);

  const handlePreview = useCallback(async (assetPath: string | null) => {
    lastPreviewPathRef.current = assetPath;
    if (assetPath) isSelectingRef.current = false;

    if (!assetPath) {
      if (!isSelectingRef.current) setPreviewSrc(null);
      return;
    }

    try {
      if (isBuiltinCover(assetPath)) {
        setPreviewSrc(getBuiltinCoverUrl(assetPath));
        return;
      }
      if (!vaultPath) return;

      const category = assetPath.startsWith('icons/') ? 'icons' : 'covers';
      const fullPath = await resolveSystemAssetPath(vaultPath, assetPath, category);
      const blobUrl = await loadImageAsBlob(fullPath);
      if (assetPath === lastPreviewPathRef.current) {
        setPreviewSrc(blobUrl);
      }
    } catch {
      if (assetPath === lastPreviewPathRef.current) {
        setPreviewSrc(null);
      }
    }
  }, [isSelectingRef, setPreviewSrc, vaultPath]);

  const handlePickerClose = useCallback(() => {
    if (!isSelectingRef.current) {
      setPreviewSrc(null);
    }
    setShowPicker(false);
  }, [isSelectingRef, setPreviewSrc, setShowPicker]);

  return {
    handleCoverSelect,
    handlePreview,
    handlePickerClose,
  };
}
