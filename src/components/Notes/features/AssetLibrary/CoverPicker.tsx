/**
 * CoverPicker - Modal for selecting or uploading cover images
 */

import { useState, useCallback, useEffect } from 'react';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import { cn } from '@/lib/utils';
import { X, Image, Upload } from 'lucide-react';
import { AssetGrid } from './AssetGrid';
import { UploadZone } from './UploadZone';
import { EmptyState } from './EmptyState';
import { CoverPickerProps, CoverPickerTab } from './types';

export function CoverPicker({ isOpen, onClose, onSelect, vaultPath }: CoverPickerProps) {
  const [activeTab, setActiveTab] = useState<CoverPickerTab>('library');
  
  const { getAssetList, loadAssets } = useNotesStore();
  
  const assets = getAssetList();
  const hasAssets = assets.length > 0;

  // Load assets when opened
  useEffect(() => {
    if (isOpen && vaultPath) {
      loadAssets(vaultPath);
    }
  }, [isOpen, vaultPath, loadAssets]);

  // Switch to library tab after upload
  const handleUploadComplete = useCallback((assetPath: string) => {
    onSelect(assetPath);
    onClose();
  }, [onSelect, onClose]);

  const handleAssetSelect = useCallback((assetPath: string) => {
    onSelect(assetPath);
    onClose();
  }, [onSelect, onClose]);

  const handleSwitchToUpload = useCallback(() => {
    setActiveTab('upload');
  }, []);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div 
        className="bg-[var(--neko-bg-primary)] rounded-xl shadow-xl w-[400px] max-h-[80vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--neko-border)]">
          <h2 className="text-[var(--neko-text-primary)] font-medium">
            Choose Cover
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-[var(--neko-hover)] text-[var(--neko-text-tertiary)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[var(--neko-border)]">
          <button
            onClick={() => setActiveTab('library')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors",
              activeTab === 'library'
                ? "text-[var(--neko-accent)] border-b-2 border-[var(--neko-accent)]"
                : "text-[var(--neko-text-secondary)] hover:text-[var(--neko-text-primary)]"
            )}
          >
            <Image className="w-4 h-4" />
            Library
            {hasAssets && (
              <span className="text-xs bg-[var(--neko-bg-tertiary)] px-1.5 py-0.5 rounded-full">
                {assets.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors",
              activeTab === 'upload'
                ? "text-[var(--neko-accent)] border-b-2 border-[var(--neko-accent)]"
                : "text-[var(--neko-text-secondary)] hover:text-[var(--neko-text-primary)]"
            )}
          >
            <Upload className="w-4 h-4" />
            Upload
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {activeTab === 'library' ? (
            hasAssets ? (
              <AssetGrid 
                onSelect={handleAssetSelect} 
                vaultPath={vaultPath} 
              />
            ) : (
              <EmptyState onUploadClick={handleSwitchToUpload} />
            )
          ) : (
            <div className="p-4">
              <UploadZone 
                onUploadComplete={handleUploadComplete}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
