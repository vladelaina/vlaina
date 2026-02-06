import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import { cn } from '@/lib/utils';
import { MdRefresh } from 'react-icons/md';
import { DeletableItem } from '@/components/ui/deletable-item';
import { AssetGridProps } from './types';
import { loadImageAsBlob } from '@/lib/assets/io/reader';
import { buildFullAssetPath } from '@/lib/assets/core/paths';
import { isBuiltinCover, getBuiltinCoverUrl } from '@/lib/assets/builtinCovers';

const PREVIEW_CLEAR_DELAY = 100;

interface AssetThumbnailProps {
  filename: string;
  size: number;
  vaultPath: string;
  onSelect: () => void;
  isHovered: boolean;
  compact?: boolean;
}

const AssetThumbnail = memo(function AssetThumbnail({
  filename, size, vaultPath, onSelect, isHovered, compact
}: AssetThumbnailProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);
  const mountIdRef = useRef(0);

  useEffect(() => {
    const currentMountId = ++mountIdRef.current;

    setSrc(null);
    setIsLoaded(false);
    setHasError(false);

    if (!imgRef.current) return;

    const observer = new IntersectionObserver(
      async (entries) => {
        if (entries[0].isIntersecting) {
          try {
            if (isBuiltinCover(filename)) {
              if (mountIdRef.current === currentMountId) {
                setSrc(getBuiltinCoverUrl(filename));
              }
            } else if (vaultPath) {
              const fullPath = buildFullAssetPath(vaultPath, filename);
              const blobUrl = await loadImageAsBlob(fullPath);

              if (mountIdRef.current === currentMountId) {
                setSrc(blobUrl);
              }
            }
          } catch (error) {
            console.error('Failed to load thumbnail:', filename, error);
          }
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(imgRef.current);

    return () => {
      observer.disconnect();
    };
  }, [filename, vaultPath]);

  const handleImageError = useCallback(() => {
    setHasError(true);
    setIsLoaded(false);
  }, []);

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const cleanFilename = filename.replace(/^@/, '');
  const displayName = cleanFilename.split('/').pop() || cleanFilename;

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
      {src && !hasError ? (
        <>
          <img
            src={src}
            alt={displayName}
            className={cn(
              "w-full h-full object-cover transition-opacity duration-200",
              isLoaded ? "opacity-100" : "opacity-0"
            )}
            onLoad={() => setIsLoaded(true)}
            onError={handleImageError}
          />
          {!isLoaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <MdRefresh className="w-5 h-5 animate-spin text-[var(--neko-text-tertiary)]" />
            </div>
          )}
        </>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-8 h-8 rounded bg-[var(--neko-bg-secondary)]" />
        </div>
      )}

      {!compact && (
        <div
          className={cn(
            "absolute inset-0 bg-black/60 flex flex-col justify-end p-2",
            "transition-opacity duration-200",
            isHovered ? "opacity-100" : "opacity-0"
          )}
        >
          <p className="text-white text-xs truncate font-medium">{displayName}</p>
          <p className="text-white/70 text-xs">{formatSize(size)}</p>
        </div>
      )}


    </div>
  );
});

export function AssetGrid({ onSelect, onHover, vaultPath, compact, itemSize, category }: AssetGridProps) {
  const { getAssetList, deleteAsset, loadAssets } = useNotesStore();
  const [hoveredFilename, setHoveredFilename] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const clearTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastHoveredRef = useRef<string | null>(null);

  const assets = getAssetList(category);

  useEffect(() => {
    if (vaultPath) {
      loadAssets(vaultPath);
    }
  }, [vaultPath, loadAssets]);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const item = target.closest('[data-filename]') as HTMLElement;
      const filename = item?.dataset.filename || null;

      if (filename && filename !== lastHoveredRef.current) {
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

  if (assets.length === 0) {
    return null;
  }

  const gridStyle = itemSize
    ? { gridTemplateColumns: `repeat(auto-fill, minmax(${itemSize}px, 1fr))` }
    : undefined;

  return (
    <>
      <div
        ref={gridRef}
        className={cn("grid gap-2 p-2", !itemSize && (compact ? "grid-cols-5" : "grid-cols-3"))}
        style={gridStyle}
      >
        {assets.map((asset) => (
          <DeletableItem
            key={asset.filename}
            id={asset.filename}
            onDelete={(id) => deleteAsset(id)}
            className="relative aspect-square rounded-lg overflow-hidden"
            disabled={isBuiltinCover(asset.filename)}
          >
            <AssetThumbnail
              filename={asset.filename}
              size={asset.size}
              vaultPath={vaultPath}
              onSelect={() => handleSelect(asset.filename)}
              isHovered={hoveredFilename === asset.filename}
              compact={compact}
            />
          </DeletableItem>
        ))}
      </div>

    </>
  );
}