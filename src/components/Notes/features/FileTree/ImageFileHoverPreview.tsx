import { useEffect, useState } from 'react';
import { loadImageAsBlob } from '@/lib/assets/io/reader';
import { resolveNotesRootRelativeFullPath } from '@/stores/notes/utils/fs/notesRootPathContainment';
import { themeFileTreeTokens } from '@/styles/themeTokens';
import { useImageFileHoverPreviewTarget } from './imageFileHoverPreviewState';

const IMAGE_HOVER_PREVIEW_ACTIVE_ATTRIBUTE = 'data-image-file-hover-preview-active';

export function ImageFileHoverPreview() {
  const target = useImageFileHoverPreviewTarget();
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!target) {
      document.documentElement.removeAttribute(IMAGE_HOVER_PREVIEW_ACTIVE_ATTRIBUTE);
      return;
    }

    document.documentElement.setAttribute(IMAGE_HOVER_PREVIEW_ACTIVE_ATTRIBUTE, 'true');
    return () => {
      document.documentElement.removeAttribute(IMAGE_HOVER_PREVIEW_ACTIVE_ATTRIBUTE);
    };
  }, [target]);

  useEffect(() => {
    if (!target) {
      setPreviewSrc(null);
      return;
    }

    let active = true;
    setPreviewSrc(null);
    const timer = window.setTimeout(() => {
      void resolveNotesRootRelativeFullPath(target.notesPath, target.imagePath)
        .then(({ fullPath }) => loadImageAsBlob(fullPath))
        .then((src) => {
          if (active) {
            setPreviewSrc(src);
          }
        })
        .catch(() => {
          if (active) {
            setPreviewSrc(null);
          }
        });
    }, themeFileTreeTokens.imageHoverPreviewDelayMs);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [target]);

  if (!target) {
    return null;
  }

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[var(--vlaina-z-40)] flex items-center justify-center bg-[var(--vlaina-bg-primary)] p-[var(--vlaina-size-32px)]"
      data-image-file-hover-preview="true"
    >
      {previewSrc ? (
        <img
          src={previewSrc}
          alt={target.imagePath}
          className="max-h-full max-w-full object-contain"
        />
      ) : null}
    </div>
  );
}
