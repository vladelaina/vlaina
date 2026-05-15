import { useState, useCallback, useEffect, useRef } from 'react';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import { cn } from '@/lib/utils';
import { Icon } from '@/components/ui/icons';
import { AssetGrid } from './AssetGrid';
import { UploadZone } from './UploadZone';
import { CoverPickerProps, CoverPickerTab } from './types';
import { Popover, PopoverContent, PopoverAnchor } from '@/components/ui/popover';
import { chatComposerPillSurfaceClass } from '@/components/Chat/features/Input/composerStyles';

const COVER_PREVIEW_DELAY_MS = 180;
const ASSET_LOAD_AFTER_OPEN_DELAY_MS = 120;

export function CoverPicker({
  isOpen,
  onClose,
  onSelect,
  onRemove,
  onPreview,
  vaultPath,
  currentNotePath,
}: CoverPickerProps) {
  const assetList = useNotesStore((state) => state.assetList);
  const loadAssets = useNotesStore((state) => state.loadAssets);
  const uploadAsset = useNotesStore((state) => state.uploadAsset);
  const hasAssets = assetList.length > 0;
  const [activeTab, setActiveTab] = useState<CoverPickerTab>('library');
  const [isUploading, setIsUploading] = useState(false);

  const uploadingRef = useRef(false);
  const mountedRef = useRef(true);
  const isOpenRef = useRef(isOpen);
  const removeTriggeredRef = useRef(false);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestPreviewAssetRef = useRef<string | null>(null);
  const showHeaderControls = hasAssets || Boolean(onRemove);

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
    if (isOpen && vaultPath) {
      let cancelled = false;
      let idleId: number | null = null;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;

      const runLoad = () => {
        if (cancelled) return;
        void loadAssets(vaultPath);
      };

      timeoutId = setTimeout(() => {
        timeoutId = null;
        if ('requestIdleCallback' in window) {
          idleId = window.requestIdleCallback(runLoad, { timeout: 600 });
        } else {
          runLoad();
        }
      }, ASSET_LOAD_AFTER_OPEN_DELAY_MS);

      return () => {
        cancelled = true;
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
        }
        if (idleId !== null && 'cancelIdleCallback' in window) {
          window.cancelIdleCallback(idleId);
        }
      };
    } else if (!isOpen) {
      const timer = setTimeout(() => {
        setActiveTab('library');
        setIsUploading(false);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [currentNotePath, hasAssets, isOpen, vaultPath, loadAssets]);

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
      onPreview?.(null);
      return;
    }

    previewTimerRef.current = setTimeout(() => {
      previewTimerRef.current = null;
      if (latestPreviewAssetRef.current === assetPath) {
        onPreview?.(assetPath);
      }
    }, COVER_PREVIEW_DELAY_MS);
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

    const handleKeyDown = (e: KeyboardEvent) => {
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
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
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
          }
          break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('paste', handlePaste);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('paste', handlePaste);
    };
  }, [currentNotePath, isOpen, onClose, uploadAsset, onSelect, onPreview]);

  return (
    <Popover open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <PopoverAnchor className="absolute bottom-4 right-4 w-1 h-1 pointer-events-none" />

      <PopoverContent
        className={cn(
          "w-[340px] !rounded-[26px] p-0 flex flex-col overflow-hidden z-50 pointer-events-auto select-none backdrop-blur-lg",
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
                    ? "bg-[var(--vlaina-accent)]/10 text-[var(--vlaina-accent)]"
                    : "text-[var(--vlaina-text-secondary)] hover:text-[var(--vlaina-text-primary)]"
                )}
              >
 <Icon size="md" name="file.image" className="inline mr-1" />
                Library
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('upload')}
                className={cn(
                  "text-xs font-medium px-2 py-1 rounded transition-colors",
                  activeTab === 'upload'
                    ? "bg-[var(--vlaina-accent)]/10 text-[var(--vlaina-accent)]"
                    : "text-[var(--vlaina-text-secondary)] hover:text-[var(--vlaina-text-primary)]"
                )}
              >
 <Icon size="md" name="common.upload" className="inline mr-1" />
                Upload
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
                Remove
              </button>
            )}
          </div>
        ) : null}

        <div className="flex-1 overflow-hidden">
          {activeTab === 'library' && hasAssets ? (
            <AssetGrid
              onSelect={handleAssetSelect}
              onHover={handleAssetHover}
              vaultPath={vaultPath}
              currentNotePath={currentNotePath}
              compact
            />
          ) : (
            <div className="p-3">
              <UploadZone onUploadComplete={handleUploadComplete} compact currentNotePath={currentNotePath} />
              {isUploading && (
                <p className="mt-1 text-xs text-center text-[var(--vlaina-accent)]">
                  Uploading...
                </p>
              )}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
