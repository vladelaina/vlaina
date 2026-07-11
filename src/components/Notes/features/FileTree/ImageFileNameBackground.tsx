import { memo, useEffect, useRef, useState } from 'react';
import { loadImageThumbnailAsBlob } from '@/lib/assets/io/reader';
import { resolveNotesRootRelativeFullPath } from '@/stores/notes/utils/fs/notesRootPathContainment';
import { themeFileTreeTokens } from '@/styles/themeTokens';

const MAX_CONCURRENT_FILE_TREE_BACKGROUNDS = 4;

interface BackgroundLoadJob {
  cancelled: boolean;
  run: () => Promise<void>;
}

const backgroundLoadQueue: BackgroundLoadJob[] = [];
let activeBackgroundLoads = 0;

function drainBackgroundLoadQueue() {
  while (activeBackgroundLoads < MAX_CONCURRENT_FILE_TREE_BACKGROUNDS) {
    const job = backgroundLoadQueue.shift();
    if (!job) return;
    if (job.cancelled) continue;
    activeBackgroundLoads += 1;
    void job.run().finally(() => {
      activeBackgroundLoads -= 1;
      drainBackgroundLoadQueue();
    });
  }
}

function enqueueBackgroundLoad(run: () => Promise<void>) {
  const job: BackgroundLoadJob = { cancelled: false, run };
  backgroundLoadQueue.push(job);
  drainBackgroundLoadQueue();
  return () => {
    job.cancelled = true;
  };
}

export const ImageFileNameBackground = memo(function ImageFileNameBackground({
  notesPath,
  imagePath,
}: {
  notesPath: string;
  imagePath: string;
}) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let cancelQueued: (() => void) | null = null;
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
      cancelQueued = enqueueBackgroundLoad(load);
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
        cancelQueued?.();
        observer.disconnect();
      };
    }

    return () => {
      active = false;
      cancelQueued?.();
    };
  }, [imagePath, notesPath]);

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
