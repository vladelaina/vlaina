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
const PREVIEW_CLEAR_DELAY = 100; // ms delay before clearing preview

interface AssetThumbnailProps {
  filename: string;
  size: number;
  vaultPath: string;
  onSelect: () => void;
  onDelete: () => void;
  isHovered: boolean;
  compact?: boolean;
}

function AssetThumbnail({ filename, size, vaultPath, onSelect, onDelete, isHovered, compact }: AssetThumbnailProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);

  // Lazy load with Intersection Observer
  useEffect(() => {
    if (!imgRef.current || !vaultPath) return; // Guard against empty vaultPath

    const observer = new IntersectionObserver(
      async (entries) => {
        if (entries[0].isIntersecting) {
          // Build full path and load as blob
          // filename may contain subdirectory (e.g., "subfolder/image.png")
          const separator = vaultPath.includes('\\') ? '\\' : '/';
          const normalizedFilename = filename.replace(/\//g, separator);
          const fullPath = `${vaultPath}${separator}${ASSETS_DIR.replace(/\//g, separator)}${separator}${normalizedFilename}`;
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
      data-filename={filename}
      className={cn(
        "relative aspect-square rounded-lg overflow-hidden cursor-pointer",
        "bg-[var(--neko-bg-tertiary)] border border-transparent",
        "hover:border-[var(--neko-accent)] transition-all duration-200",
        "group"
      )}
      onClick={onSelect}
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
      {!compact && (
        <div
          className={cn(
            "absolute inset-0 bg-black/60 flex flex-col justify-end p-2",
            "transition-opacity duration-200",
            isHovered ? "opacity-100" : "opacity-0"
          )}
        >
          <p className="text-white text-xs truncate font-medium">{filename.split('/').pop()}</p>
          <p className="text-white/70 text-xs">{formatSize(size)}</p>
        </div>
      )}

      {/* Delete button */}
      {!compact && (
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
      )}
    </div>
  );
}

export function AssetGrid({ onSelect, onHover, vaultPath, compact }: AssetGridProps) {
  const { getAssetList, deleteAsset, loadAssets } = useNotesStore();
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [hoveredFilename, setHoveredFilename] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const clearTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastHoveredRef = useRef<string | null>(null);
  
  const assets = getAssetList();

  // Load assets on mount
  useEffect(() => {
    if (vaultPath) {
      loadAssets(vaultPath);
    }
  }, [vaultPath, loadAssets]);

  // Event delegation for hover - similar to emoji picker
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const item = target.closest('[data-filename]') as HTMLElement;
      const filename = item?.dataset.filename || null;

      // Only update when hovering a NEW image (not when moving to gap)
      // This prevents preview from clearing when moving between images
      if (filename && filename !== lastHoveredRef.current) {
        // Clear any pending clear timeout
        if (clearTimeoutRef.current) {
          clearTimeout(clearTimeoutRef.current);
          clearTimeoutRef.current = null;
        }

        lastHoveredRef.current = filename;
        setHoveredFilename(filename);
        onHover?.(filename);
      }
    };

    const handleMouseLeave = () => {
      // Delay clearing preview to handle gaps between items
      if (clearTimeoutRef.current) {
        clearTimeout(clearTimeoutRef.current);
      }
      clearTimeoutRef.current = setTimeout(() => {
        lastHoveredRef.current = null;
        setHoveredFilename(null);
        onHover?.(null);
      }, PREVIEW_CLEAR_DELAY);
    };

    grid.addEventListener('mouseover', handleMouseOver);
    grid.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      grid.removeEventListener('mouseover', handleMouseOver);
      grid.removeEventListener('mouseleave', handleMouseLeave);
      if (clearTimeoutRef.current) {
        clearTimeout(clearTimeoutRef.current);
      }
    };
  }, [onHover]);

  const handleSelect = useCallback((filename: string) => {
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
      <div 
        ref={gridRef}
        className={cn("grid gap-1.5 p-2", compact ? "grid-cols-4" : "grid-cols-3 gap-2")}
      >
        {assets.map((asset) => (
          <AssetThumbnail
            key={asset.filename}
            filename={asset.filename}
            size={asset.size}
            vaultPath={vaultPath}
            onSelect={() => handleSelect(asset.filename)}
            onDelete={() => handleDeleteClick(asset.filename)}
            isHovered={hoveredFilename === asset.filename}
            compact={compact}
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
