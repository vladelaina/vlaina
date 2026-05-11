import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { Icon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { loadImageThumbnailAsBlob } from '@/lib/assets/io/reader';
import { resolveVaultAssetPath } from '@/lib/assets/core/paths';
import { isBuiltinCover, getBuiltinCoverUrl } from '@/lib/assets/builtinCovers';

const MAX_CONCURRENT_THUMBNAIL_LOADS = 2;

interface ThumbnailLoadJob {
  cancelled: boolean;
  priority: number;
  sequence: number;
  run: () => Promise<void>;
}

const thumbnailLoadQueue: ThumbnailLoadJob[] = [];
let activeThumbnailLoads = 0;
let thumbnailLoadSequence = 0;

function drainThumbnailLoadQueue() {
  thumbnailLoadQueue.sort((a, b) => a.priority - b.priority || a.sequence - b.sequence);

  while (activeThumbnailLoads < MAX_CONCURRENT_THUMBNAIL_LOADS) {
    const job = thumbnailLoadQueue.shift();
    if (!job) return;
    if (job.cancelled) continue;

    activeThumbnailLoads += 1;
    void job.run()
      .catch(() => undefined)
      .finally(() => {
        activeThumbnailLoads = Math.max(0, activeThumbnailLoads - 1);
        drainThumbnailLoadQueue();
      });
  }
}

function enqueueThumbnailLoad(run: () => Promise<void>, priority: number) {
  const job: ThumbnailLoadJob = {
    cancelled: false,
    priority,
    sequence: thumbnailLoadSequence++,
    run,
  };
  thumbnailLoadQueue.push(job);
  drainThumbnailLoadQueue();
  return () => {
    job.cancelled = true;
  };
}

interface AssetThumbnailProps {
  filename: string;
  size: number;
  vaultPath: string;
  currentNotePath?: string;
  onSelect: () => void;
  isHovered: boolean;
  compact?: boolean;
  loadPriority?: number;
}

export const AssetThumbnail = memo(function AssetThumbnail({
  filename, size, vaultPath, currentNotePath, onSelect, isHovered, compact, loadPriority = Number.MAX_SAFE_INTEGER
}: AssetThumbnailProps) {
  const builtinSrc = isBuiltinCover(filename) ? getBuiltinCoverUrl(filename) : null;
  const [src, setSrc] = useState<string | null>(() => builtinSrc);
  const [isLoaded, setIsLoaded] = useState(() => Boolean(builtinSrc));
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);
  const mountIdRef = useRef(0);

  useEffect(() => {
    const currentMountId = ++mountIdRef.current;
    let cancelQueuedLoad: (() => void) | null = null;

    setHasError(false);

    if (builtinSrc) {
      setSrc(builtinSrc);
      setIsLoaded(true);
      return;
    }

    setSrc(null);
    setIsLoaded(false);

    if (!imgRef.current) return;

    const loadThumbnail = async () => {
      try {
        if (vaultPath) {
          const fullPath = await resolveVaultAssetPath(vaultPath, filename, currentNotePath);
          const blobUrl = await loadImageThumbnailAsBlob(fullPath);

          if (mountIdRef.current === currentMountId) {
            setSrc(blobUrl);
          }
        }
      } catch (error) {
        if (mountIdRef.current === currentMountId) {
          setHasError(true);
        }
        console.error('Failed to load thumbnail:', filename, error);
      }
    };

    if (typeof IntersectionObserver === 'undefined') {
      cancelQueuedLoad = enqueueThumbnailLoad(loadThumbnail, loadPriority);
      return () => {
        cancelQueuedLoad?.();
      };
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          cancelQueuedLoad = enqueueThumbnailLoad(loadThumbnail, loadPriority);
          observer.disconnect();
        }
      },
      { rootMargin: '80px', threshold: 0.01 }
    );

    observer.observe(imgRef.current);

    return () => {
      cancelQueuedLoad?.();
      observer.disconnect();
    };
  }, [builtinSrc, currentNotePath, filename, loadPriority, vaultPath]);

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
        "bg-[var(--vlaina-bg-tertiary)] border border-transparent",
        "hover:border-[var(--vlaina-accent)] transition-all duration-200",
        "group"
      )}
      onClick={onSelect}
    >
      {src && !hasError ? (
        <>
          <img
            src={src}
            alt={displayName}
            loading={builtinSrc ? 'eager' : 'lazy'}
            decoding="async"
            className={cn(
              "w-full h-full object-cover transition-opacity duration-200",
              isLoaded ? "opacity-100" : "opacity-0"
            )}
            onLoad={() => setIsLoaded(true)}
            onError={handleImageError}
          />
          {!isLoaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Icon name="common.refresh" className="w-5 h-5 animate-spin text-[var(--vlaina-text-tertiary)]" />
            </div>
          )}
        </>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-8 h-8 rounded bg-[var(--vlaina-bg-secondary)]" />
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
