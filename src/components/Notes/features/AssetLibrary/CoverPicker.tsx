/**
 * CoverPicker - Modal for selecting or uploading cover images
 */

import { useState, useCallback, useEffect } from 'react';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import { cn } from '@/lib/utils';
import { X, Image, Upload, Trash2, Loader2 } from 'lucide-react';
import { AssetGrid } from './AssetGrid';
import { UploadZone } from './UploadZone';
import { EmptyState } from './EmptyState';
import { CoverPickerProps, CoverPickerTab } from './types';

export function CoverPicker({ isOpen, onClose, onSelect, vaultPath }: CoverPickerProps) {
  const [activeTab, setActiveTab] = useState<CoverPickerTab>('library');
  const [showCleanupConfirm, setShowCleanupConfirm] = useState(false);
  const [unusedAssets, setUnusedAssets] = useState<string[]>([]);
  const [isLoadingUnused, setIsLoadingUnused] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<number | null>(null);
  
  const { getAssetList, loadAssets, getUnusedAssets, cleanUnusedAssets } = useNotesStore();
  
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

  // Handle cleanup button click - scan for unused assets
  const handleCleanupClick = useCallback(async () => {
    setIsLoadingUnused(true);
    setCleanupResult(null);
    try {
      const unused = await getUnusedAssets();
      setUnusedAssets(unused);
      setShowCleanupConfirm(true);
    } catch (error) {
      console.error('Failed to get unused assets:', error);
    } finally {
      setIsLoadingUnused(false);
    }
  }, [getUnusedAssets]);

  // Handle cleanup confirmation
  const handleCleanupConfirm = useCallback(async () => {
    try {
      const count = await cleanUnusedAssets();
      setCleanupResult(count);
      setShowCleanupConfirm(false);
      setUnusedAssets([]);
      // Reload assets to refresh the list
      if (vaultPath) {
        await loadAssets(vaultPath);
      }
    } catch (error) {
      console.error('Failed to clean unused assets:', error);
    }
  }, [cleanUnusedAssets, vaultPath, loadAssets]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showCleanupConfirm) {
          setShowCleanupConfirm(false);
        } else {
          onClose();
        }
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose, showCleanupConfirm]);

  // Clear cleanup result after showing
  useEffect(() => {
    if (cleanupResult !== null) {
      const timer = setTimeout(() => setCleanupResult(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [cleanupResult]);

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

        {/* Footer with cleanup button - only show in library tab with assets */}
        {activeTab === 'library' && hasAssets && (
          <div className="px-4 py-3 border-t border-[var(--neko-border)] flex items-center justify-between">
            {cleanupResult !== null ? (
              <span className="text-sm text-green-500">
                Cleaned {cleanupResult} unused {cleanupResult === 1 ? 'asset' : 'assets'}
              </span>
            ) : (
              <span className="text-xs text-[var(--neko-text-tertiary)]">
                {assets.length} {assets.length === 1 ? 'asset' : 'assets'}
              </span>
            )}
            <button
              onClick={handleCleanupClick}
              disabled={isLoadingUnused}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm",
                "text-[var(--neko-text-secondary)] hover:text-[var(--neko-text-primary)]",
                "hover:bg-[var(--neko-hover)] transition-colors",
                isLoadingUnused && "opacity-50 cursor-not-allowed"
              )}
            >
              {isLoadingUnused ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              Clean Unused
            </button>
          </div>
        )}
      </div>

      {/* Cleanup confirmation dialog */}
      {showCleanupConfirm && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]"
          onClick={() => setShowCleanupConfirm(false)}
        >
          <div 
            className="bg-[var(--neko-bg-primary)] rounded-lg p-4 max-w-sm mx-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-[var(--neko-text-primary)] font-medium mb-2">
              Clean Unused Assets
            </h3>
            {unusedAssets.length === 0 ? (
              <>
                <p className="text-[var(--neko-text-secondary)] text-sm mb-4">
                  All assets are currently in use. Nothing to clean up!
                </p>
                <div className="flex justify-end">
                  <button
                    onClick={() => setShowCleanupConfirm(false)}
                    className="px-3 py-1.5 rounded-md text-sm bg-[var(--neko-accent)] text-white hover:opacity-90"
                  >
                    OK
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-[var(--neko-text-secondary)] text-sm mb-3">
                  Found {unusedAssets.length} unused {unusedAssets.length === 1 ? 'asset' : 'assets'}:
                </p>
                <div className="max-h-32 overflow-auto mb-4 bg-[var(--neko-bg-secondary)] rounded-md p-2">
                  {unusedAssets.map((filename) => (
                    <div 
                      key={filename}
                      className="text-xs text-[var(--neko-text-tertiary)] truncate py-0.5"
                    >
                      {filename}
                    </div>
                  ))}
                </div>
                <p className="text-[var(--neko-text-tertiary)] text-xs mb-4">
                  This action cannot be undone.
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowCleanupConfirm(false)}
                    className="px-3 py-1.5 rounded-md text-sm text-[var(--neko-text-secondary)] hover:bg-[var(--neko-hover)]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCleanupConfirm}
                    className="px-3 py-1.5 rounded-md text-sm bg-red-500 text-white hover:bg-red-600"
                  >
                    Delete {unusedAssets.length} {unusedAssets.length === 1 ? 'Asset' : 'Assets'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
