import { memo, useEffect, useRef, useState } from 'react';
import { loadImageThumbnailAsBlob } from '@/lib/assets/io/reader';
import { createBoundedAsyncQueue } from '@/lib/boundedAsyncQueue';
import { resolveNotesRootRelativeFullPath } from '@/stores/notes/utils/fs/notesRootPathContainment';
import { themeFileTreeTokens } from '@/styles/themeTokens';
import { useImageCacheGeneration } from '@/hooks/useImageCacheGeneration';

const MAX_CONCURRENT_FILE_TREE_BACKGROUNDS = 4;
const FILE_TREE_BACKGROUND_LOAD_TIMEOUT_MS = import.meta.env.MODE === 'test' ? 1000 : 15_000;

function createAbortError() {
  const error = new Error('File tree image background load aborted');
  error.name = 'AbortError';
  return error;
}

const backgroundLoadQueue = createBoundedAsyncQueue({
  concurrency: MAX_CONCURRENT_FILE_TREE_BACKGROUNDS,
  createAbortError,
  createTimeoutError: () => new Error('File tree image background load timed out'),
  timeoutMs: FILE_TREE_BACKGROUND_LOAD_TIMEOUT_MS,
});

export const ImageFileNameBackground = memo(function ImageFileNameBackground({
  notesPath,
  imagePath,
}: {
  notesPath: string;
  imagePath: string;
}) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const imageCacheGeneration = useImageCacheGeneration();

  useEffect(() => {
    let active = true;
    setSrc(null);
    const abortController = new AbortController();
    const load = async () => {
      try {
        const { fullPath } = await resolveNotesRootRelativeFullPath(notesPath, imagePath);
        const nextSrc = await loadImageThumbnailAsBlob(fullPath, {
          maxEdgePx: themeFileTreeTokens.imageThumbnailDecodeEdgePx,
        });
        if (active) setSrc(nextSrc);
      } catch {
      }
    };
    const queueLoad = () => {
      void backgroundLoadQueue.run(load, abortController.signal).catch(() => undefined);
    };

    if (typeof IntersectionObserver === 'undefined' || !rootRef.current) {
      queueLoad();
    } else {
      const observer = new IntersectionObserver((entries) => {
        if (entries[0]?.isIntersecting) {
          queueLoad();
          observer.disconnect();
        }
      });
      observer.observe(rootRef.current);
      return () => {
        active = false;
        abortController.abort();
        observer.disconnect();
      };
    }

    return () => {
      active = false;
      abortController.abort();
    };
  }, [imageCacheGeneration, imagePath, notesPath]);

  return (
    <span
      ref={rootRef}
      aria-hidden="true"
      data-file-tree-image-background={imagePath}
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-lg"
    >
      {src ? (
        <span
          className="absolute inset-0 bg-cover bg-center opacity-[var(--vlaina-opacity-30)]"
          style={{ backgroundImage: `url(${JSON.stringify(src)})` }}
        />
      ) : null}
      <span className="absolute inset-0 bg-[var(--vlaina-sidebar-notes-surface)] opacity-[var(--vlaina-opacity-35)]" />
    </span>
  );
});
