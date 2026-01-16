/**
 * CoverPicker - Popover for selecting or uploading cover images
 * Positioned at bottom-right of cover for real-time preview
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import { cn } from '@/lib/utils';
import { Image, Upload } from 'lucide-react';
import { AssetGrid } from './AssetGrid';
import { UploadZone } from './UploadZone';
import { EmptyState } from './EmptyState';
import { CoverPickerProps, CoverPickerTab } from './types';
import { Popover, PopoverContent, PopoverAnchor } from '@/components/ui/popover';

export function CoverPicker({ isOpen, onClose, onSelect, onRemove, onPreview, vaultPath }: CoverPickerProps) {
  const [activeTab, setActiveTab] = useState<CoverPickerTab>('library');
  const [isUploading, setIsUploading] = useState(false);

  const { getAssetList, loadAssets, uploadAsset } = useNotesStore();
  const uploadingRef = useRef(false);

  const assets = getAssetList('covers');
  const hasAssets = assets.length > 0;

  // Load assets when opened
  useEffect(() => {
    if (isOpen && vaultPath) {
      loadAssets(vaultPath);
    } else if (!isOpen) {
      // Reset tab state when closed (after a short delay for animation)
      const timer = setTimeout(() => {
        setActiveTab('library');
        setIsUploading(false);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isOpen, vaultPath, loadAssets]);

  // Handle asset selection with preview
  const handleAssetSelect = useCallback((assetPath: string) => {
    // Only call onSelect - let parent handle closing to avoid race condition
    onSelect(assetPath);
  }, [onSelect]);

  // Handle asset hover for preview
  const handleAssetHover = useCallback((assetPath: string | null) => {
    onPreview?.(assetPath);
  }, [onPreview]);

  const handleUploadComplete = useCallback((assetPath: string) => {
    // Only call onSelect - let parent handle closing
    onSelect(assetPath);
  }, [onSelect]);

  const handleSwitchToUpload = useCallback(() => {
    setActiveTab('upload');
  }, []);

  // Handle escape key and paste
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

            const result = await uploadAsset(file);

            uploadingRef.current = false;
            setIsUploading(false);

            if (result.success && result.path) {
              onSelect(result.path);
              // Don't call onClose here - let parent handle it
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
  }, [isOpen, onClose, uploadAsset, onSelect, onPreview]);

  return (
    <Popover open={isOpen} onOpenChange={(open) => !open && onClose()}>
      {/* 
        Anchor is placed at the bottom-right of the parent container 
        (which is the CoverImage component wrapper)
      */}
      <PopoverAnchor className="absolute bottom-4 right-4 w-1 h-1 pointer-events-none" />

      <PopoverContent
        className="w-[280px] p-0 flex flex-col overflow-hidden bg-[var(--neko-bg-primary)] border-[var(--neko-border)] shadow-xl z-50 pointer-events-auto select-none"
        align="end"
        side="bottom"
        sideOffset={8}
        // Prevent event propagation so clicking inside doesn't trigger parent actions
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--neko-border)] bg-[var(--neko-bg-primary)]">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('library')}
              className={cn(
                "text-xs font-medium px-2 py-1 rounded transition-colors",
                activeTab === 'library'
                  ? "bg-[var(--neko-accent)]/10 text-[var(--neko-accent)]"
                  : "text-[var(--neko-text-secondary)] hover:text-[var(--neko-text-primary)]"
              )}
            >
              <Image className="w-3.5 h-3.5 inline mr-1" />
              Library
            </button>
            <button
              onClick={() => setActiveTab('upload')}
              className={cn(
                "text-xs font-medium px-2 py-1 rounded transition-colors",
                activeTab === 'upload'
                  ? "bg-[var(--neko-accent)]/10 text-[var(--neko-accent)]"
                  : "text-[var(--neko-text-secondary)] hover:text-[var(--neko-text-primary)]"
              )}
            >
              <Upload className="w-3.5 h-3.5 inline mr-1" />
              Upload
            </button>
          </div>
          {onRemove && (
            <button
              onClick={() => {
                onRemove();
                onClose();
              }}
              className="text-xs text-[var(--neko-text-tertiary)] hover:text-[var(--neko-text-primary)] transition-colors"
            >
              Remove
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto max-h-[280px]">
          {activeTab === 'library' ? (
            hasAssets ? (
              <AssetGrid
                onSelect={handleAssetSelect}
                onHover={handleAssetHover}
                vaultPath={vaultPath}
                compact
                category="covers"
              />
            ) : (
              <EmptyState onUploadClick={handleSwitchToUpload} compact />
            )
          ) : (
            <div className="p-3">
              <UploadZone onUploadComplete={handleUploadComplete} compact />
              <p className="mt-2 text-xs text-center text-[var(--neko-text-tertiary)]">
                {navigator.userAgent.includes('Mac') ? '⌘' : 'Ctrl'}+V to paste
              </p>
              {isUploading && (
                <p className="mt-1 text-xs text-center text-[var(--neko-accent)]">
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
