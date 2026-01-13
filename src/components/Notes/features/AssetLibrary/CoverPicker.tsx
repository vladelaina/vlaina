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

export function CoverPicker({ isOpen, onClose, onSelect, onRemove, onPreview, vaultPath }: CoverPickerProps) {
  const [activeTab, setActiveTab] = useState<CoverPickerTab>('library');
  const [isUploading, setIsUploading] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  
  const { getAssetList, loadAssets, uploadAsset } = useNotesStore();
  const uploadingRef = useRef(false);
  
  const assets = getAssetList();
  const hasAssets = assets.length > 0;

  // Load assets when opened
  useEffect(() => {
    if (isOpen && vaultPath) {
      loadAssets(vaultPath);
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

  // Handle click outside to close
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onPreview?.(null);
        onClose();
      }
    };

    // Delay to avoid immediate close on open click
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose, onPreview]);

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

  if (!isOpen) return null;

  return (
    <div 
      ref={pickerRef}
      className="absolute top-full right-2 mt-2 z-40 bg-[var(--neko-bg-primary)] rounded-lg shadow-xl border border-[var(--neko-border)] w-[280px] max-h-[320px] flex flex-col overflow-hidden select-none"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--neko-border)]">
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
      <div className="flex-1 overflow-auto">
        {activeTab === 'library' ? (
          hasAssets ? (
            <AssetGrid 
              onSelect={handleAssetSelect}
              onHover={handleAssetHover}
              vaultPath={vaultPath}
              compact
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
    </div>
  );
}
