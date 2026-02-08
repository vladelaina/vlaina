import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { MdRefresh } from 'react-icons/md';
import { cn } from '@/lib/utils';
import { loadImageAsBlob } from '@/lib/assets/io/reader';
import { resolveSystemAssetPath } from '@/lib/assets/core/paths';
import { isBuiltinCover, getBuiltinCoverUrl } from '@/lib/assets/builtinCovers';

interface AssetThumbnailProps {
  filename: string;
  size: number;
  vaultPath: string;
  onSelect: () => void;
  isHovered: boolean;
  compact?: boolean;
}

export const AssetThumbnail = memo(function AssetThumbnail({
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
              const category = filename.startsWith('icons/') ? 'icons' : 'covers';
              const fullPath = await resolveSystemAssetPath(vaultPath, filename, category);
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
