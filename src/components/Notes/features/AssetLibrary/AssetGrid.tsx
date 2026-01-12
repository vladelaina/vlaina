/**
 * AssetGrid - Grid display of assets from the library
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import { cn } from '@/lib/utils';
import { Trash2, Loader2 } from 'lucide-react';
import { AssetGridProps } from './types';
import { loadImageAsBlob } from '@/lib/assets/imageLoader';

const ASSETS_DIR = '.nekotick/assets/covers';

interface AssetThumbnailProps {
  filename: string;
  size: number;
  vaultPath: string;
  onSelect: () => void;
  onDelete: () => void;
}

function AssetThumbnail({ filename, size, vaultPath, onSelect, onDelete }: AssetThumbnailProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);

  // Lazy load with Intersection Observer
  useEffect(() => {
    if (!imgRef.current) return;

    const observer = new IntersectionObserver(
      async (entries) => {
        if (entries[0].isIntersecting) {
          // Build full path and load as blob
          const separator = vaultPath.includes('\\') ? '\\' : '/';
          const fullPath = `${vaultPath}${separator}${ASSETS_DIR.replace(/\//g, separator)}${separator}${filename}`;
          try {
            const blobUrl = await loadImageAsBlob(fullPath);
            setSrc(blobUrl);
          } catch (error) {
            console.error('Failed to load thumbnail:', filename, error);
          }
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(imgRef.current);
    return () => observer.disconnect();
  }, [filename, vaultPath]);

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete();
  };

  return (
    <div
      ref={imgRef}
      className={cn(
        "relative aspect-square rounded-lg overflow-hidden cursor-pointer",
        "bg-[var(--neko-bg-tertiary)] border border-transparent",
        "hover:border-[var(--neko-accent)] transition-all duration-200",
        "group"
      )}
      onClick={onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {src ? (
        <>
          <img
            src={src}
            alt={filename}
            className={cn(
              "w-full h-full object-cover transition-opacity duration-200",
              isLoaded ? "opacity-100" : "opacity-0"
            )}
            onLoad={() => setIsLoaded(true)}
          />
          {!isLoaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-[var(--neko-text-tertiary)]" />
            </div>
          )}
        </>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-8 h-8 rounded bg-[var(--neko-bg-secondary)]" />
        </div>
      )}

      {/* Hover overlay with info */}
      <div
        className={cn(
          "absolute inset-0 bg-black/60 flex flex-col justify-end p-2",
          "transition-opacity duration-200",
          isHovered ? "opacity-100" : "opacity-0"
        )}
      >
        <p className="text-white text-xs truncate font-medium">{filename}</p>
        <p className="text-white/70 text-xs">{formatSize(size)}</p>
      </div>

      {/* Delete button */}
      <button
        onClick={handleDelete}
        className={cn(
          "absolute top-2 right-2 p-1.5 rounded-md",
          "bg-red-500/80 hover:bg-red-500 text-white",
          "transition-all duration-200",
          isHovered ? "opacity-100" : "opacity-0"
        )}
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export function AssetGrid({ onSelect, vaultPath }: AssetGridProps) {
  const { getAssetList, deleteAsset, loadAssets } = useNotesStore();
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  
  const assets = getAssetList();

  // Load assets on mount
  useEffect(() => {
    if (vaultPath) {
      loadAssets(vaultPath);
    }
  }, [vaultPath, loadAssets]);

  const handleSelect = useCallback((filename: string) => {
    // Return only filename, not full path
    onSelect(filename);
  }, [onSelect]);

  const handleDeleteClick = useCallback((filename: string) => {
    setDeleteConfirm(filename);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (deleteConfirm) {
      await deleteAsset(deleteConfirm);
      setDeleteConfirm(null);
    }
  }, [deleteConfirm, deleteAsset]);

  if (assets.length === 0) {
    return null; // EmptyState will be shown by parent
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-2 p-2">
        {assets.map((asset) => (
          <AssetThumbnail
            key={asset.filename}
            filename={asset.filename}
            size={asset.size}
            vaultPath={vaultPath}
            onSelect={() => handleSelect(asset.filename)}
            onDelete={() => handleDeleteClick(asset.filename)}
          />
        ))}
      </div>

      {/* Delete confirmation dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--neko-bg-primary)] rounded-lg p-4 max-w-sm mx-4 shadow-xl">
            <h3 className="text-[var(--neko-text-primary)] font-medium mb-2">
              Delete Asset
            </h3>
            <p className="text-[var(--neko-text-secondary)] text-sm mb-4">
              Are you sure you want to delete "{deleteConfirm}"? Notes using this image will show a broken image.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-3 py-1.5 rounded-md text-sm text-[var(--neko-text-secondary)] hover:bg-[var(--neko-hover)]"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-3 py-1.5 rounded-md text-sm bg-red-500 text-white hover:bg-red-600"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
