import { useState, useCallback, useEffect, useRef } from 'react';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import { cn } from '@/lib/utils';
import { Icon } from '@/components/ui/icons';
import { AssetGrid } from './AssetGrid';
import { UploadZone } from './UploadZone';
import { CoverPickerProps, CoverPickerTab } from './types';
import { Popover, PopoverContent, PopoverAnchor } from '@/components/ui/popover';
import { chatComposerPillSurfaceClass } from '@/components/Chat/features/Input/composerStyles';
import { useI18n } from '@/lib/i18n';
import { themeLazyLoadTokens } from '@/styles/themeTokens';
import { AssetLibraryLoadingState } from './AssetLibraryLoadingState';
import { isImageFileLike } from '@/lib/assets/core/naming';

function getPastedImageFile(item: DataTransferItem): File | null {
  if (item.kind && item.kind !== 'file') return null;

  const itemMimeType = item.type.split(';')[0]?.trim().toLowerCase() ?? '';
  if (itemMimeType.startsWith('image/')) {
    return item.getAsFile();
  }

  if (itemMimeType && itemMimeType !== 'application/octet-stream') {
    return null;
  }

  const file = item.getAsFile();
  if (!file) return null;

  return isImageFileLike(file) ? file : null;
}

export function CoverPicker({
  isOpen,
  onClose,
  onSelect,
  onRemove,
  onPreview,
  notesRootPath,
  currentNotePath,
  anchorPlacement = 'cover',
}: CoverPickerProps) {
  const { t } = useI18n();
  const assetList = useNotesStore((state) => state.assetList);
  const isLoadingAssets = useNotesStore((state) => state.isLoadingAssets);
  const loadAssets = useNotesStore((state) => state.loadAssets);
  const uploadAsset = useNotesStore((state) => state.uploadAsset);
  const hasAssets = assetList.length > 0;
  const [activeTab, setActiveTab] = useState<CoverPickerTab>('library');
  const [isUploading, setIsUploading] = useState(false);
  const [isPickerAssetRefreshPending, setIsPickerAssetRefreshPending] = useState(
    () => isOpen && Boolean(notesRootPath)
  );
  const assetRefreshScope = `${notesRootPath}\0${currentNotePath ?? ''}`;

  const uploadingRef = useRef(false);
  const mountedRef = useRef(true);
  const isOpenRef = useRef(isOpen);
  const requestedAssetScopeRef = useRef<string | null>(null);
  const removeTriggeredRef = useRef(false);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestPreviewAssetRef = useRef<string | null>(null);
  const showHeaderControls = hasAssets || Boolean(onRemove);
  const anchorClassName = cn(
    'absolute w-1 h-1 pointer-events-none',
    anchorPlacement === 'empty-cover-option'
      ? 'top-[var(--vlaina-size-80px)] right-[max(var(--vlaina-size-16px),calc((100%_-_var(--vlaina-width-editor-content-max))_/_2))]'
      : 'bottom-4 right-4'
  );
  const isUnrefreshedAssetScope =
    isOpen && Boolean(notesRootPath) && requestedAssetScopeRef.current !== assetRefreshScope;
  const shouldShowLibraryLoading = activeTab === 'library' && (
    isPickerAssetRefreshPending ||
    isUnrefreshedAssetScope ||
    (isLoadingAssets && !hasAssets)
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      uploadingRef.current = false;
      if (previewTimerRef.current) {
        clearTimeout(previewTimerRef.current);
        previewTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    isOpenRef.current = isOpen;
    if (!isOpen) {
      uploadingRef.current = false;
      removeTriggeredRef.current = false;
      latestPreviewAssetRef.current = null;
      if (previewTimerRef.current) {
        clearTimeout(previewTimerRef.current);
        previewTimerRef.current = null;
      }
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && notesRootPath) {
      let cancelled = false;
      requestedAssetScopeRef.current = assetRefreshScope;
      setIsPickerAssetRefreshPending(true);
      void Promise.resolve(loadAssets(notesRootPath))
        .catch(() => undefined)
        .finally(() => {
          if (!cancelled && mountedRef.current) {
            setIsPickerAssetRefreshPending(false);
          }
        });

      return () => {
        cancelled = true;
      };
    }

    requestedAssetScopeRef.current = null;
    setIsPickerAssetRefreshPending(false);

    if (!isOpen) {
      const timer = setTimeout(() => {
        setActiveTab('library');
        setIsUploading(false);
      }, themeLazyLoadTokens.coverPickerResetAfterCloseDelayMs);
      return () => clearTimeout(timer);
    }
  }, [assetRefreshScope, isOpen, notesRootPath, loadAssets]);

  const handleAssetSelect = useCallback((assetPath: string) => {
    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }
    latestPreviewAssetRef.current = null;
    onSelect(assetPath);
  }, [onSelect]);

  const handleAssetHover = useCallback((assetPath: string | null) => {
    latestPreviewAssetRef.current = assetPath;
    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }

    if (!assetPath) {
      return;
    }

    previewTimerRef.current = setTimeout(() => {
      previewTimerRef.current = null;
      if (latestPreviewAssetRef.current === assetPath) {
        onPreview?.(assetPath);
      }
    }, themeLazyLoadTokens.coverPreviewDelayMs);
  }, [onPreview]);

  const handleUploadComplete = useCallback((assetPath: string) => {
    onSelect(assetPath);
  }, [onSelect]);

  const handleRemoveCover = useCallback((event: React.SyntheticEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (removeTriggeredRef.current) return;
    removeTriggeredRef.current = true;
    onPreview?.(null);
    onRemove?.();
    onClose();
  }, [onClose, onPreview, onRemove]);

  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideMouseDown = (e: MouseEvent) => {
      const target = e.target;
      if (!(target instanceof Element)) {
        return;
      }
      if (target.closest('[data-slot="popover-content"], [data-no-editor-drag-box="true"], [data-note-cover-region="true"]')) {
        return;
      }

      onPreview?.(null);
      onClose();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.isComposing) {
        return;
      }
      if (e.key === 'Escape') {
        onPreview?.(null);
        onClose();
      }
    };

    const handlePaste = async (e: ClipboardEvent) => {
      if (uploadingRef.current) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        const file = getPastedImageFile(item);
        if (file) {
          e.preventDefault();
          uploadingRef.current = true;
          setIsUploading(true);

          try {
            const result = await uploadAsset(file, currentNotePath);

            if (mountedRef.current && isOpenRef.current && result.success && result.path) {
              onSelect(result.path);
            }
          } finally {
            uploadingRef.current = false;
            if (mountedRef.current && isOpenRef.current) {
              setIsUploading(false);
            }
          }
          break;
        }
      }
    };

    document.addEventListener('mousedown', handleOutsideMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('paste', handlePaste);
    return () => {
      document.removeEventListener('mousedown', handleOutsideMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('paste', handlePaste);
    };
  }, [currentNotePath, isOpen, onClose, uploadAsset, onSelect, onPreview]);

  return (
    <Popover open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <PopoverAnchor className={anchorClassName} />

      <PopoverContent
        data-no-editor-drag-box="true"
        className={cn(
          "w-[var(--vlaina-size-340px)] !rounded-[var(--vlaina-radius-26px)] p-0 flex flex-col overflow-hidden z-[var(--vlaina-z-50)] pointer-events-auto select-none backdrop-blur-[var(--vlaina-backdrop-blur-lg)]",
          chatComposerPillSurfaceClass,
        )}
        align="end"
        side="bottom"
        sideOffset={8}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {showHeaderControls ? (
          <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--vlaina-border)]">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('library')}
                className={cn(
                  "text-xs font-medium px-2 py-1 rounded transition-colors",
                  activeTab === 'library'
                    ? "bg-[var(--vlaina-color-accent-soft-bg)] text-[var(--vlaina-accent)]"
                    : "text-[var(--vlaina-text-secondary)] hover:text-[var(--vlaina-text-primary)]"
                )}
              >
 <Icon size="md" name="file.image" className="inline mr-1" />
                {t('asset.library')}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('upload')}
                className={cn(
                  "text-xs font-medium px-2 py-1 rounded transition-colors",
                  activeTab === 'upload'
                    ? "bg-[var(--vlaina-color-accent-soft-bg)] text-[var(--vlaina-accent)]"
                    : "text-[var(--vlaina-text-secondary)] hover:text-[var(--vlaina-text-primary)]"
                )}
              >
 <Icon size="md" name="common.upload" className="inline mr-1" />
                {t('common.upload')}
              </button>
            </div>
            {onRemove && (
              <button
                type="button"
                onPointerDown={handleRemoveCover}
                onMouseDown={handleRemoveCover}
                onClick={handleRemoveCover}
                className="text-xs text-[var(--vlaina-text-tertiary)] hover:text-[var(--vlaina-text-primary)] transition-colors"
              >
                {t('common.remove')}
              </button>
            )}
          </div>
        ) : null}

        <div className="flex-1 overflow-hidden">
          {shouldShowLibraryLoading ? (
            <AssetLibraryLoadingState />
          ) : activeTab === 'library' && hasAssets ? (
            <AssetGrid
              onSelect={handleAssetSelect}
              onHover={handleAssetHover}
              notesRootPath={notesRootPath}
              currentNotePath={currentNotePath}
              compact
            />
          ) : (
            <div className="p-3">
              <UploadZone onUploadComplete={handleUploadComplete} compact currentNotePath={currentNotePath} />
              {isUploading && (
                <p className="mt-1 text-xs text-center text-[var(--vlaina-accent)]">
                  {t('asset.uploading')}
                </p>
              )}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
