import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Cropper from "react-easy-crop";
import { Icon } from "@/components/ui/icons";
import { BlurBackdrop } from "@/components/common/BlurBackdrop";
import { writeTextToClipboard } from "@/lib/clipboard";
import { cn, iconButtonStyles } from "@/lib/utils";
import { copyImageSourceToClipboard } from "@/components/Chat/common/messageClipboard";
import { downloadImageWithPrompt } from "@/components/Chat/common/imageDownload";

interface ChatImageViewerProps {
  open: boolean;
  src: string;
  alt?: string;
  gallery?: Array<{ id: string; src: string }>;
  currentImageId?: string;
  onOpenChange: (open: boolean) => void;
}

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.12;

async function copyImageOrUrl(src: string): Promise<boolean> {
  const copied = await copyImageSourceToClipboard(src);
  if (copied) {
    return true;
  }
  return writeTextToClipboard(src);
}

function clampZoom(value: number): number {
  if (value < MIN_ZOOM) {
    return MIN_ZOOM;
  }
  if (value > MAX_ZOOM) {
    return MAX_ZOOM;
  }
  return Number(value.toFixed(2));
}

function normalizeComparableSrc(value: string): string {
  const trimmed = value.trim();
  try {
    return decodeURIComponent(trimmed);
  } catch {
    return trimmed;
  }
}

export function ChatImageViewer({
  open,
  src,
  alt,
  gallery,
  currentImageId,
  onOpenChange,
}: ChatImageViewerProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [copied, setCopied] = useState(false);
  const [aspectRatio, setAspectRatio] = useState(1);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const [viewportSize, setViewportSize] = useState({ width: 1440, height: 900 });
  const [activeGalleryIndex, setActiveGalleryIndex] = useState(-1);

  const galleryIndex = useMemo(() => {
    if (!gallery || gallery.length === 0) {
      return -1;
    }
    if (currentImageId) {
      const byId = gallery.findIndex((item) => item.id === currentImageId);
      if (byId !== -1) {
        return byId;
      }
    }
    const normalizedSrc = normalizeComparableSrc(src);
    return gallery.findIndex((item) => normalizeComparableSrc(item.src) === normalizedSrc);
  }, [currentImageId, gallery, src]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setActiveGalleryIndex(galleryIndex);
  }, [galleryIndex, open]);

  const activeGalleryItem =
    gallery && activeGalleryIndex >= 0 && activeGalleryIndex < gallery.length
      ? gallery[activeGalleryIndex]
      : null;
  const activeSrc = activeGalleryItem?.src ?? src;
  const activeAlt = alt;
  const canNavigate = !!gallery && gallery.length > 1 && activeGalleryIndex >= 0;
  const hasPrevious = canNavigate && activeGalleryIndex > 0;
  const hasNext = canNavigate && activeGalleryIndex < gallery.length - 1;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const updateSize = () => {
      setViewportSize({ width: window.innerWidth, height: window.innerHeight });
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => {
      window.removeEventListener("resize", updateSize);
    };
  }, []);

  useEffect(() => {
    if (!open || typeof document === "undefined") {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open || typeof window === "undefined") {
      return;
    }
    let active = true;
    const image = new window.Image();
    image.onload = () => {
      if (!active) {
        return;
      }
      const width = image.naturalWidth || 1;
      const height = image.naturalHeight || 1;
      setAspectRatio(width / height);
      setImageSize({ width, height });
    };
    image.onerror = () => {
      if (!active) {
        return;
      }
      setAspectRatio(1);
      setImageSize(null);
    };
    image.src = activeSrc;
    return () => {
      active = false;
    };
  }, [activeSrc, open]);

  useEffect(() => {
    if (!open || typeof window === "undefined") {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false);
        return;
      }
      if (event.key === "ArrowLeft" && hasPrevious) {
        event.preventDefault();
        setActiveGalleryIndex((value) => Math.max(value - 1, 0));
        return;
      }
      if (event.key === "ArrowRight" && hasNext) {
        event.preventDefault();
        setActiveGalleryIndex((value) => Math.min(value + 1, (gallery?.length ?? 1) - 1));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [gallery?.length, hasNext, hasPrevious, onOpenChange, open]);

  const percentLabel = useMemo(() => `${Math.round(zoom * 100)}%`, [zoom]);
  const imageSizeLabel = useMemo(() => {
    if (!imageSize) {
      return null;
    }
    return `${imageSize.width}×${imageSize.height}`;
  }, [imageSize]);
  const previewMetrics = useMemo(() => {
    const isMobile = viewportSize.width < 640;
    const maxWidth = Math.min(viewportSize.width * (isMobile ? 0.94 : 0.86), 1200);
    const maxHeight = Math.min(viewportSize.height * (isMobile ? 0.74 : 0.78), 900);
    const safeAspect = aspectRatio > 0 ? aspectRatio : 1;
    const viewportAspect = viewportSize.width / Math.max(viewportSize.height, 1);
    const fitWidthAtZoomOne =
      safeAspect >= viewportAspect
        ? viewportSize.width
        : viewportSize.height * safeAspect;
    const fitHeightAtZoomOne =
      safeAspect >= viewportAspect
        ? viewportSize.width / safeAspect
        : viewportSize.height;
    const initialZoom = clampZoom(
      Math.min(
        maxWidth / Math.max(fitWidthAtZoomOne, 1),
        maxHeight / Math.max(fitHeightAtZoomOne, 1)
      )
    );
    const minZoom = Math.max(0.2, Number((initialZoom * 0.35).toFixed(2)));
    return {
      initialZoom,
      minZoom,
    };
  }, [aspectRatio, viewportSize.height, viewportSize.width]);

  const isPointOnImage = (clientX: number, clientY: number) => {
    const safeAspect = aspectRatio > 0 ? aspectRatio : 1;
    const viewportAspect = viewportSize.width / Math.max(viewportSize.height, 1);
    const baseWidth =
      safeAspect >= viewportAspect
        ? viewportSize.width
        : viewportSize.height * safeAspect;
    const baseHeight =
      safeAspect >= viewportAspect
        ? viewportSize.width / safeAspect
        : viewportSize.height;

    const scaledWidth = baseWidth * zoom;
    const scaledHeight = baseHeight * zoom;
    const left = viewportSize.width / 2 - scaledWidth / 2 + crop.x;
    const top = viewportSize.height / 2 - scaledHeight / 2 + crop.y;
    const right = left + scaledWidth;
    const bottom = top + scaledHeight;

    return clientX >= left && clientX <= right && clientY >= top && clientY <= bottom;
  };

  useEffect(() => {
    if (!open) {
      return;
    }
    setCrop({ x: 0, y: 0 });
    setZoom(previewMetrics.initialZoom);
  }, [activeSrc, open, previewMetrics.initialZoom]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1200);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const handleCopy = async () => {
    try {
      setCopied(await copyImageOrUrl(activeSrc));
    } catch {
      setCopied(false);
    }
  };

  if (!isMounted || !open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <>
      <BlurBackdrop className="pointer-events-none" zIndex={120} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={activeAlt || "Image preview"}
        className="fixed inset-0 z-[121]"
        data-no-focus-input="true"
        onClick={(event) => {
          if (isPointOnImage(event.clientX, event.clientY)) {
            return;
          }
          onOpenChange(false);
        }}
      >
        <button
          type="button"
          aria-label="Close preview"
          data-no-focus-input="true"
          className={cn(
            "absolute right-4 top-4 z-10 rounded-full bg-black/45 p-1.5 text-white/90 backdrop-blur-sm hover:bg-black/55 hover:text-white",
            iconButtonStyles,
            "text-white/90 hover:text-white"
          )}
          onClick={(event) => {
            event.stopPropagation();
            onOpenChange(false);
          }}
        >
          <Icon name="common.close" size="md" />
        </button>

        {hasPrevious && (
          <div className="absolute inset-y-0 left-4 z-10 flex items-center">
            <button
              type="button"
              aria-label="Previous image"
              data-no-focus-input="true"
              className={cn(
                "inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/80 bg-white/78 text-slate-700 shadow-[0_18px_54px_rgba(84,121,160,0.16)] transition-colors hover:bg-white",
                iconButtonStyles
              )}
              onClick={(event) => {
                event.stopPropagation();
                setActiveGalleryIndex((value) => Math.max(value - 1, 0));
              }}
            >
              <Icon name="nav.chevronLeft" size="md" />
            </button>
          </div>
        )}

        {hasNext && (
          <div className="absolute inset-y-0 right-4 z-10 flex items-center">
            <button
              type="button"
              aria-label="Next image"
              data-no-focus-input="true"
              className={cn(
                "inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/80 bg-white/78 text-slate-700 shadow-[0_18px_54px_rgba(84,121,160,0.16)] transition-colors hover:bg-white",
                iconButtonStyles
              )}
              onClick={(event) => {
                event.stopPropagation();
                setActiveGalleryIndex((value) => Math.min(value + 1, (gallery?.length ?? 1) - 1));
              }}
            >
              <Icon name="nav.chevronRight" size="md" />
            </button>
          </div>
        )}

        <div className="relative h-full w-full">
          <div className="absolute inset-0">
            <Cropper
              image={activeSrc}
              crop={crop}
              zoom={zoom}
              minZoom={previewMetrics.minZoom}
              maxZoom={MAX_ZOOM}
              showGrid={false}
              zoomWithScroll={true}
              zoomSpeed={0.12}
              restrictPosition={false}
              objectFit="contain"
              onCropChange={setCrop}
              onZoomChange={(value) => setZoom(clampZoom(value))}
              style={{
                containerStyle: { backgroundColor: "transparent" },
                cropAreaStyle: {
                  border: "none",
                  boxShadow: "none",
                  color: "transparent",
                  outline: "none",
                  background: "transparent",
                },
                mediaStyle: {
                  maxWidth: "none",
                  maxHeight: "none",
                },
              }}
            />
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex justify-center">
            <div
              className="pointer-events-auto inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-2 py-2 text-slate-800 shadow-[0_18px_40px_rgba(15,23,42,0.14)]"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                aria-label="Zoom out"
                data-no-focus-input="true"
                className={cn(
                  "inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-700 transition-colors hover:bg-zinc-100",
                  iconButtonStyles
                )}
                onClick={() => setZoom((value) => clampZoom(value - ZOOM_STEP))}
              >
                <Icon name="common.remove" size="md" />
              </button>
              <span className="min-w-[50px] px-1.5 text-center text-xs font-semibold tabular-nums text-slate-800">
                {percentLabel}
              </span>
              <button
                type="button"
                aria-label="Zoom in"
                data-no-focus-input="true"
                className={cn(
                  "inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-700 transition-colors hover:bg-zinc-100",
                  iconButtonStyles
                )}
                onClick={() => setZoom((value) => clampZoom(value + ZOOM_STEP))}
              >
                <Icon name="common.add" size="md" />
              </button>
              <div className="mx-1 h-6 w-px bg-zinc-200" />
              {imageSizeLabel && (
                <span className="min-w-[78px] px-3 text-center text-[11px] font-medium tabular-nums text-slate-500">
                  {imageSizeLabel}
                </span>
              )}
              <div className="mx-1 h-6 w-px bg-zinc-200" />
              <button
                type="button"
                aria-label="Copy image"
                data-no-focus-input="true"
                className={cn(
                  "inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-700 transition-colors hover:bg-zinc-100",
                  iconButtonStyles
                )}
                onClick={() => {
                    void handleCopy();
                }}
              >
                <Icon name={copied ? "common.check" : "common.copy"} size="md" />
              </button>
              <button
                type="button"
                aria-label="Download image"
                data-no-focus-input="true"
                className={cn(
                  "inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-700 transition-colors hover:bg-zinc-100",
                  iconButtonStyles
                )}
                onClick={() => {
                  void downloadImageWithPrompt(activeSrc, activeAlt);
                }}
              >
                <Icon name="common.download" size="md" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
