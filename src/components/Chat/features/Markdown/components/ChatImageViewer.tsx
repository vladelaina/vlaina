import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { createPortal } from "react-dom";
import Cropper from "react-easy-crop";
import { Icon } from "@/components/ui/icons";
import { writeTextToClipboard } from "@/lib/clipboard";
import { cn, iconButtonStyles } from "@/lib/utils";
import { copyImageSourceToClipboard } from "@/components/Chat/common/messageClipboard";
import { downloadImageWithPrompt } from "@/components/Chat/common/imageDownload";
import { chatPopoverPillSurfaceClass } from "@/components/Chat/features/Input/composerStyles";
import { useI18n } from "@/lib/i18n";
import { convertToBase64, type Attachment } from "@/lib/storage/attachmentStorage";

interface ChatImageViewerProps {
  open: boolean;
  src: string;
  alt?: string;
  gallery?: Array<{ id: string; src: string }>;
  currentImageId?: string;
  previewSrc?: string | null;
  onOpenChange: (open: boolean) => void;
}

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.12;
const TRANSPARENT_IMAGE_DATA_URL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
const VIEWER_CONTROL_SELECTOR = '[data-chat-image-viewer-control="true"]';
const CROPPER_IMAGE_SELECTOR = '.reactEasyCrop_Image';
const VIEWER_SURFACE_SELECTOR = '[data-chat-image-viewer-surface="true"]';
const resolvedViewerImageCache = new Map<string, Promise<string>>();
const imageViewerToolbarButtonClass =
  "inline-flex h-9 w-9 items-center justify-center rounded-full bg-transparent text-slate-700 transition-colors hover:bg-black/5 dark:text-slate-700 dark:hover:bg-black/5";

function getViewerFitBounds(viewportSize: { width: number; height: number }) {
  const horizontalPadding = viewportSize.width < 640 ? 28 : 96;
  const verticalPadding = viewportSize.height < 640 ? 96 : 140;
  return {
    maxWidth: Math.max(1, viewportSize.width - horizontalPadding),
    maxHeight: Math.max(1, viewportSize.height - verticalPadding),
  };
}

function resolveInitialViewerZoom({
  mediaHeight,
  mediaWidth,
  naturalHeight,
  naturalWidth,
  viewportSize,
}: {
  mediaHeight: number;
  mediaWidth: number;
  naturalHeight: number;
  naturalWidth: number;
  viewportSize: { width: number; height: number };
}): number {
  const { maxHeight, maxWidth } = getViewerFitBounds(viewportSize);
  const targetWidth = Math.min(naturalWidth || mediaWidth, maxWidth);
  const targetHeight = Math.min(naturalHeight || mediaHeight, maxHeight);
  return clampZoom(Math.min(
    1,
    targetWidth / Math.max(mediaWidth, 1),
    targetHeight / Math.max(mediaHeight, 1),
  ));
}

async function copyImageOrUrl(src: string): Promise<boolean> {
  const copied = await copyImageSourceToClipboard(src);
  if (copied) {
    return true;
  }
  if (src.trim().startsWith("data:image/")) {
    return false;
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

function requiresAttachmentResolution(src: string): boolean {
  const trimmed = src.trim();
  return trimmed.startsWith("attachment://") || trimmed.startsWith("app-file://attachment/");
}

function inferAttachmentMimeType(src: string): string {
  const normalized = src.trim().toLowerCase().split(/[?#]/)[0] ?? "";
  if (normalized.endsWith(".png")) return "image/png";
  if (normalized.endsWith(".jpg") || normalized.endsWith(".jpeg")) return "image/jpeg";
  if (normalized.endsWith(".webp")) return "image/webp";
  if (normalized.endsWith(".gif")) return "image/gif";
  if (normalized.endsWith(".avif")) return "image/avif";
  if (normalized.endsWith(".bmp")) return "image/bmp";
  if (normalized.endsWith(".svg")) return "image/svg+xml";
  return "image/*";
}

async function resolveViewerImageSource(src: string): Promise<string> {
  if (!requiresAttachmentResolution(src)) {
    return src;
  }

  const cached = resolvedViewerImageCache.get(src);
  if (cached) {
    return cached;
  }

  const attachment: Attachment = {
    id: "viewer-image",
    path: "",
    previewUrl: src,
    assetUrl: src,
    name: "image",
    type: inferAttachmentMimeType(src),
    size: 0,
  };
  const resolved = convertToBase64(attachment).catch((error) => {
    resolvedViewerImageCache.delete(src);
    throw error;
  });
  resolvedViewerImageCache.set(src, resolved);
  return resolved;
}

export function ChatImageViewer({
  open,
  src,
  alt,
  gallery,
  currentImageId,
  previewSrc,
  onOpenChange,
}: ChatImageViewerProps) {
  const { t } = useI18n();
  const [isMounted, setIsMounted] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [copied, setCopied] = useState(false);
  const [aspectRatio, setAspectRatio] = useState(1);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const [mediaSize, setMediaSize] = useState<{ width: number; height: number; naturalWidth: number; naturalHeight: number } | null>(null);
  const [mediaReady, setMediaReady] = useState(false);
  const [viewportSize, setViewportSize] = useState({ width: 1440, height: 900 });
  const [activeGalleryIndex, setActiveGalleryIndex] = useState(-1);
  const [resolvedActiveSrc, setResolvedActiveSrc] = useState(src);
  const imageElementRef = useRef<HTMLImageElement | null>(null);

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
  const cropperImageSrc =
    requiresAttachmentResolution(activeSrc) && resolvedActiveSrc === activeSrc
      ? TRANSPARENT_IMAGE_DATA_URL
      : resolvedActiveSrc;

  useEffect(() => {
    if (!open) {
      return;
    }

    let active = true;
    const immediateSrc = activeSrc === src && previewSrc ? previewSrc : activeSrc;
    setResolvedActiveSrc(immediateSrc);

    resolveViewerImageSource(activeSrc)
      .then((resolvedSrc) => {
        if (active) {
          setResolvedActiveSrc(resolvedSrc);
        }
      })
      .catch(() => {
        if (active) {
          setResolvedActiveSrc(activeSrc);
        }
      });

    return () => {
      active = false;
    };
  }, [activeSrc, open, previewSrc, src]);

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
    const { maxHeight, maxWidth } = getViewerFitBounds(viewportSize);
    const safeAspect = aspectRatio > 0 ? aspectRatio : 1;
    const viewportAspect = viewportSize.width / Math.max(viewportSize.height, 1);
    const fitWidthAtZoomOne = mediaSize?.width || (
      safeAspect >= viewportAspect
        ? viewportSize.width
        : viewportSize.height * safeAspect
    );
    const fitHeightAtZoomOne = mediaSize?.height || (
      safeAspect >= viewportAspect
        ? viewportSize.width / safeAspect
        : viewportSize.height
    );
    const naturalWidth = mediaSize?.naturalWidth || imageSize?.width || fitWidthAtZoomOne;
    const naturalHeight = mediaSize?.naturalHeight || imageSize?.height || fitHeightAtZoomOne;
    const targetWidth = Math.min(naturalWidth, maxWidth);
    const targetHeight = Math.min(naturalHeight, maxHeight);
    const initialZoom = clampZoom(
      Math.min(
        1,
        targetWidth / Math.max(fitWidthAtZoomOne, 1),
        targetHeight / Math.max(fitHeightAtZoomOne, 1)
      )
    );
    const minZoom = Math.max(0.2, Number((initialZoom * 0.35).toFixed(2)));
    return {
      initialZoom,
      minZoom,
    };
  }, [aspectRatio, imageSize?.height, imageSize?.width, mediaSize, viewportSize.height, viewportSize.width]);
  const cropperViewportSize = useMemo(
    () => ({
      width: Math.max(1, viewportSize.width),
      height: Math.max(1, viewportSize.height),
    }),
    [viewportSize.height, viewportSize.width],
  );

  const isPointOnImage = useCallback((clientX: number, clientY: number) => {
    if (typeof document !== "undefined" && typeof document.elementsFromPoint === "function") {
      const elementsAtPoint = document.elementsFromPoint(clientX, clientY);
      return elementsAtPoint.some((element) => (
        element === imageElementRef.current ||
        element.matches(CROPPER_IMAGE_SELECTOR)
      ));
    }

    const imageRect = imageElementRef.current?.getBoundingClientRect();
    if (imageRect && imageRect.width > 0 && imageRect.height > 0) {
      return (
        clientX >= imageRect.left &&
        clientX <= imageRect.right &&
        clientY >= imageRect.top &&
        clientY <= imageRect.bottom
      );
    }

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
  }, [aspectRatio, crop.x, crop.y, viewportSize.height, viewportSize.width, zoom]);

  useEffect(() => {
    if (!open || typeof document === "undefined") {
      return;
    }

    const handleDocumentPress = (event: MouseEvent | globalThis.PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (
        event.button !== 0 ||
        target?.closest(VIEWER_CONTROL_SELECTOR) ||
        !target?.closest(VIEWER_SURFACE_SELECTOR) ||
        target === imageElementRef.current ||
        target?.matches(CROPPER_IMAGE_SELECTOR)
      ) {
        return;
      }

      onOpenChange(false);
    };

    document.addEventListener("pointerdown", handleDocumentPress, true);
    document.addEventListener("mousedown", handleDocumentPress, true);
    document.addEventListener("click", handleDocumentPress, true);
    return () => {
      document.removeEventListener("pointerdown", handleDocumentPress, true);
      document.removeEventListener("mousedown", handleDocumentPress, true);
      document.removeEventListener("click", handleDocumentPress, true);
    };
  }, [isPointOnImage, onOpenChange, open]);

  const handleDialogPointerDownCapture = (event: PointerEvent<HTMLDivElement>) => {
    const target = event.target instanceof Element ? event.target : null;
    if (
      event.button !== 0 ||
      target?.closest(VIEWER_CONTROL_SELECTOR) ||
      target === imageElementRef.current ||
      target?.matches(CROPPER_IMAGE_SELECTOR)
    ) {
      return;
    }

    onOpenChange(false);
  };

  useEffect(() => {
    if (!open) {
      return;
    }
    setCrop({ x: 0, y: 0 });
    setMediaSize(null);
    setMediaReady(false);
  }, [activeSrc, open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (mediaReady) {
      setZoom(previewMetrics.initialZoom);
    }
  }, [activeSrc, mediaReady, open, previewMetrics.initialZoom]);

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
      <div
        role="dialog"
        aria-modal="true"
        aria-label={activeAlt || "Image preview"}
        className="fixed inset-0 z-[121]"
        data-no-focus-input="true"
        data-chat-image-viewer-surface="true"
        onPointerDownCapture={handleDialogPointerDownCapture}
        onClick={(event) => {
          if (isPointOnImage(event.clientX, event.clientY)) {
            return;
          }
          onOpenChange(false);
        }}
      >
        <button
          type="button"
          aria-label={t('chat.closePreview')}
          data-no-focus-input="true"
          data-chat-image-viewer-control="true"
          className={cn(
            "absolute right-12 top-12 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition-all hover:bg-zinc-100 hover:text-zinc-950",
            "dark:text-zinc-500 dark:hover:bg-zinc-100 dark:hover:text-zinc-950",
            iconButtonStyles
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
              aria-label={t('chat.previousImage')}
              data-no-focus-input="true"
              data-chat-image-viewer-control="true"
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
              aria-label={t('chat.nextImage')}
              data-no-focus-input="true"
              data-chat-image-viewer-control="true"
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
          <div
            className={cn(
              "absolute inset-0 transition-opacity duration-100",
              mediaReady ? "opacity-100" : "opacity-0"
            )}
          >
            <Cropper
              image={cropperImageSrc}
              crop={crop}
              cropSize={cropperViewportSize}
              zoom={zoom}
              minZoom={previewMetrics.minZoom}
              maxZoom={MAX_ZOOM}
              showGrid={false}
              zoomWithScroll={true}
              zoomSpeed={0.12}
              restrictPosition={false}
              objectFit="contain"
              setImageRef={(ref) => {
                imageElementRef.current = ref.current;
              }}
              onMediaLoaded={(mediaSize) => {
                if (cropperImageSrc === TRANSPARENT_IMAGE_DATA_URL) {
                  return;
                }
                const width = mediaSize.naturalWidth || mediaSize.width || 1;
                const height = mediaSize.naturalHeight || mediaSize.height || 1;
                const nextZoom = resolveInitialViewerZoom({
                  mediaHeight: mediaSize.height || height,
                  mediaWidth: mediaSize.width || width,
                  naturalHeight: height,
                  naturalWidth: width,
                  viewportSize,
                });
                setAspectRatio(width / height);
                setImageSize({ width, height });
                setMediaSize({
                  width: mediaSize.width || width,
                  height: mediaSize.height || height,
                  naturalWidth: width,
                  naturalHeight: height,
                });
                setCrop({ x: 0, y: 0 });
                setZoom(nextZoom);
                setMediaReady(true);
              }}
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
                  pointerEvents: "none",
                },
              }}
            />
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex justify-center">
            <div
              data-chat-image-viewer-control="true"
              className={cn(
                "pointer-events-auto inline-flex items-center gap-1 rounded-full px-2 py-2 text-slate-800",
                chatPopoverPillSurfaceClass
              )}
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                aria-label={t('chat.zoomOut')}
                data-no-focus-input="true"
                className={cn(
                  imageViewerToolbarButtonClass,
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
                aria-label={t('chat.zoomIn')}
                data-no-focus-input="true"
                className={cn(
                  imageViewerToolbarButtonClass,
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
                aria-label={t('chat.copyImage')}
                data-no-focus-input="true"
                data-action="copy"
                className={cn(
                  imageViewerToolbarButtonClass,
                  iconButtonStyles,
                  copied && "text-[var(--vlaina-accent,#3b82f6)] bg-[rgb(39_131_222_/_0.12)]"
                )}
                onClick={() => {
                    void handleCopy();
                }}
              >
                <Icon name={copied ? "common.check" : "common.copy"} size="md" />
              </button>
              <button
                type="button"
                aria-label={t('chat.downloadImage')}
                data-no-focus-input="true"
                className={cn(
                  imageViewerToolbarButtonClass,
                  iconButtonStyles
                )}
                onClick={() => {
                  void downloadImageWithPrompt(resolvedActiveSrc, activeAlt);
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
