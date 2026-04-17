import { useState, useCallback, useEffect, useRef } from 'react';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import { cn } from '@/lib/utils';
import { Icon } from '@/components/ui/icons';
import { AssetGrid } from './AssetGrid';
import { UploadZone } from './UploadZone';
import { EmptyState } from './EmptyState';
import { CoverPickerProps, CoverPickerTab } from './types';
import { Popover, PopoverContent, PopoverAnchor } from '@/components/ui/popover';


export function CoverPicker({
  isOpen,
  onClose,
  onSelect,
  onRemove,
  onPreview,
  vaultPath,
  currentNotePath,
}: CoverPickerProps) {
  const isMac = typeof window !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const [activeTab, setActiveTab] = useState<CoverPickerTab>('library');
  const [isUploading, setIsUploading] = useState(false);

  const { getAssetList, loadAssets, uploadAsset } = useNotesStore();
  const uploadingRef = useRef(false);

  const assets = getAssetList('builtinCovers');
  const hasAssets = assets.length > 0;

  useEffect(() => {
    if (isOpen && vaultPath) {
      loadAssets(vaultPath);
    } else if (!isOpen) {
      const timer = setTimeout(() => {
        setActiveTab('library');
        setIsUploading(false);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isOpen, vaultPath, loadAssets]);

  const handleAssetSelect = useCallback((assetPath: string) => {
    onSelect(assetPath);
  }, [onSelect]);

  const handleAssetHover = useCallback((assetPath: string | null) => {
    onPreview?.(assetPath);
  }, [onPreview]);

  const handleUploadComplete = useCallback((assetPath: string) => {
    onSelect(assetPath);
  }, [onSelect]);

  const handleSwitchToUpload = useCallback(() => {
    setActiveTab('upload');
  }, []);

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

            const result = await uploadAsset(file, currentNotePath);

            uploadingRef.current = false;
            setIsUploading(false);

            if (result.success && result.path) {
              onSelect(result.path);
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
        className="w-[340px] p-0 flex flex-col overflow-hidden bg-[var(--vlaina-bg-primary)] border-[var(--vlaina-border)] shadow-xl z-50 pointer-events-auto select-none"
        align="end"
        side="bottom"
        sideOffset={8}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >

        <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--vlaina-border)] bg-[var(--vlaina-bg-primary)]">
          <div className="flex items-center gap-2">
            <button
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
              onClick={() => {
                onRemove();
                onClose();
              }}
              className="text-xs text-[var(--vlaina-text-tertiary)] hover:text-[var(--vlaina-text-primary)] transition-colors"
            >
              Remove
            </button>
          )}
        </div>

        <div className="flex-1 overflow-hidden">
          {activeTab === 'library' ? (
            hasAssets ? (
              <AssetGrid
                onSelect={handleAssetSelect}
                onHover={handleAssetHover}
                vaultPath={vaultPath}
                compact
                category="builtinCovers"
              />
            ) : (
              <EmptyState onUploadClick={handleSwitchToUpload} compact />
            )
          ) : (
            <div className="p-3">
              <UploadZone onUploadComplete={handleUploadComplete} compact currentNotePath={currentNotePath} />
              <p className="mt-2 text-xs text-center text-[var(--vlaina-text-tertiary)]">
                {isMac ? '⌘' : 'Ctrl'}+V to paste
              </p>
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
