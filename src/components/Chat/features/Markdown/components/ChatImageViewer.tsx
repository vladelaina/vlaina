import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { createPortal } from "react-dom";
import Cropper from "react-easy-crop";
import { Icon } from "@/components/ui/icons";
import { writeTextToClipboard } from "@/lib/clipboard";
import { cn, iconButtonStyles } from "@/lib/utils";
import { copyImageSourceToClipboard } from "@/components/Chat/common/messageClipboard";
import { downloadImageWithPrompt } from "@/components/Chat/common/imageDownload";
import { resolveSafeChatImageSource } from "@/components/Chat/common/chatImageSourceResolution";
import { chatPopoverPillSurfaceClass } from "@/components/Chat/features/Input/composerStyles";
import {
  isRenderableDataImageSrc,
  normalizeRenderableImageSrc,
} from "@/components/common/markdown/imagePolicy";
import { useI18n } from "@/lib/i18n";
import { createStoredAttachmentFromSource } from "@/lib/storage/attachmentStorage";
import { themeChatImageViewerTokens, themeCropperTokens, themeStyleResetTokens } from "@/styles/themeTokens";

interface ChatImageViewerProps {
  open: boolean;
  src: string;
  alt?: string;
  gallery?: Array<{ id: string; src: string }>;
  currentImageId?: string;
  previewSrc?: string | null;
  onOpenChange: (open: boolean) => void;
}

const MIN_ZOOM = themeChatImageViewerTokens.minZoom;
const MAX_ZOOM = themeChatImageViewerTokens.maxZoom;
const ZOOM_STEP = themeChatImageViewerTokens.zoomStep;
const TRANSPARENT_IMAGE_DATA_URL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
const VIEWER_CONTROL_SELECTOR = '[data-chat-image-viewer-control="true"]';
const CROPPER_IMAGE_SELECTOR = '.reactEasyCrop_Image';
const VIEWER_SURFACE_SELECTOR = '[data-chat-image-viewer-surface="true"]';
const RESOLVED_VIEWER_IMAGE_CACHE_LIMIT = 100;
export const RESOLVED_VIEWER_IMAGE_CACHE_CHAR_LIMIT = 32 * 1024 * 1024;
const MAX_COMPARABLE_IMAGE_SRC_DECODE_CHARS = 4096;
const resolvedViewerImageCache = new Map<string, Promise<string | null>>();
const resolvedViewerImageCacheSizes = new Map<string, number>();
let resolvedViewerImageCacheChars = 0;
const imageViewerToolbarButtonClass =
  "inline-flex h-9 w-9 items-center justify-center rounded-full bg-transparent text-[var(--vlaina-color-text-strong)] transition-colors hover:bg-[var(--vlaina-hover)]";

type ViewerPoint = { x: number; y: number };
type ViewerSize = { width: number; height: number };

function getViewerFitBounds(viewportSize: { width: number; height: number }) {
  const horizontalPadding = viewportSize.width < themeChatImageViewerTokens.fitPaddingBreakpointPx
    ? themeChatImageViewerTokens.fitHorizontalPaddingCompactPx
    : themeChatImageViewerTokens.fitHorizontalPaddingWidePx;
  const verticalPadding = viewportSize.height < themeChatImageViewerTokens.fitPaddingBreakpointPx
    ? themeChatImageViewerTokens.fitVerticalPaddingCompactPx
    : themeChatImageViewerTokens.fitVerticalPaddingWidePx;
  return {
    maxWidth: Math.max(themeChatImageViewerTokens.minViewportSizePx, viewportSize.width - horizontalPadding),
    maxHeight: Math.max(themeChatImageViewerTokens.minViewportSizePx, viewportSize.height - verticalPadding),
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
        targetWidth / Math.max(mediaWidth, themeChatImageViewerTokens.minViewportSizePx),
        targetHeight / Math.max(mediaHeight, themeChatImageViewerTokens.minViewportSizePx),
  ));
}

async function copyImageOrUrl(src: string): Promise<boolean> {
  const copied = await copyImageSourceToClipboard(src);
  if (copied) {
    return true;
  }
  if (isRenderableDataImageSrc(src)) {
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
  if (trimmed.length > MAX_COMPARABLE_IMAGE_SRC_DECODE_CHARS) {
    return trimmed;
  }
  try {
    return decodeURIComponent(trimmed);
  } catch {
    return trimmed;
  }
}

function requiresAttachmentResolution(src: string): boolean {
  return createStoredAttachmentFromSource(src) !== null;
}

function removeResolvedViewerImageCacheEntry(src: string): void {
  const cachedSize = resolvedViewerImageCacheSizes.get(src) ?? 0;
  if (cachedSize > 0) {
    resolvedViewerImageCacheChars = Math.max(0, resolvedViewerImageCacheChars - cachedSize);
  }
  resolvedViewerImageCacheSizes.delete(src);
  resolvedViewerImageCache.delete(src);
}

function pruneResolvedViewerImageCache(): void {
  while (resolvedViewerImageCacheChars > RESOLVED_VIEWER_IMAGE_CACHE_CHAR_LIMIT) {
    const oldestKey = resolvedViewerImageCacheSizes.keys().next().value;
    if (!oldestKey) {
      break;
    }
    removeResolvedViewerImageCacheEntry(oldestKey);
  }
}

function rememberResolvedViewerImageCacheSize(src: string, resolvedSrc: string | null): void {
  if (!resolvedViewerImageCache.has(src)) {
    return;
  }

  const nextSize = resolvedSrc?.length ?? 0;
  const previousSize = resolvedViewerImageCacheSizes.get(src) ?? 0;
  resolvedViewerImageCacheChars = Math.max(0, resolvedViewerImageCacheChars - previousSize);
  resolvedViewerImageCacheSizes.delete(src);

  if (nextSize <= 0 || nextSize > RESOLVED_VIEWER_IMAGE_CACHE_CHAR_LIMIT) {
    removeResolvedViewerImageCacheEntry(src);
    return;
  }

  resolvedViewerImageCacheSizes.set(src, nextSize);
  resolvedViewerImageCacheChars += nextSize;
  pruneResolvedViewerImageCache();
}

function getInitialViewerImageSource(src: string): string {
  if (requiresAttachmentResolution(src)) {
    return src;
  }
  return normalizeRenderableImageSrc(src) ?? TRANSPARENT_IMAGE_DATA_URL;
}

async function resolveViewerImageSource(src: string): Promise<string | null> {
  if (!requiresAttachmentResolution(src)) {
    return resolveSafeChatImageSource(src, "viewer-image");
  }

  const cached = resolvedViewerImageCache.get(src);
  if (cached) {
    resolvedViewerImageCache.delete(src);
    resolvedViewerImageCache.set(src, cached);
    const cachedSize = resolvedViewerImageCacheSizes.get(src);
    if (cachedSize !== undefined) {
      resolvedViewerImageCacheSizes.delete(src);
      resolvedViewerImageCacheSizes.set(src, cachedSize);
    }
    return cached;
  }

  const resolved = resolveSafeChatImageSource(src, "viewer-image")
    .then((resolvedSrc) => {
      rememberResolvedViewerImageCacheSize(src, resolvedSrc);
      return resolvedSrc;
    })
    .catch((error) => {
      removeResolvedViewerImageCacheEntry(src);
      throw error;
    });
  if (resolvedViewerImageCache.size >= RESOLVED_VIEWER_IMAGE_CACHE_LIMIT) {
    const oldestKey = resolvedViewerImageCache.keys().next().value;
    if (oldestKey) {
      removeResolvedViewerImageCacheEntry(oldestKey);
    }
  }
  resolvedViewerImageCache.set(src, resolved);
  return resolved;
}

function warmViewerImageSource(src: string | null | undefined): void {
  if (!src || !requiresAttachmentResolution(src) || resolvedViewerImageCache.has(src)) {
    return;
  }

  void resolveViewerImageSource(src).catch(() => undefined);
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
  const [crop, setCrop] = useState<ViewerPoint>({ x: themeCropperTokens.defaultCropX, y: themeCropperTokens.defaultCropY });
  const [zoom, setZoom] = useState(1);
  const [copied, setCopied] = useState(false);
  const [aspectRatio, setAspectRatio] = useState(1);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const [mediaSize, setMediaSize] = useState<{ width: number; height: number; naturalWidth: number; naturalHeight: number } | null>(null);
  const [mediaReady, setMediaReady] = useState(false);
  const [viewportSize, setViewportSize] = useState<ViewerSize>({
    width: themeChatImageViewerTokens.defaultViewportWidthPx,
    height: themeChatImageViewerTokens.defaultViewportHeightPx,
  });
  const [activeGalleryIndex, setActiveGalleryIndex] = useState(-1);
  const [resolvedActiveSrc, setResolvedActiveSrc] = useState(() => getInitialViewerImageSource(src));
  const imageElementRef = useRef<HTMLImageElement | null>(null);

  const galleryIndex = useMemo(() => {
    if (!open) {
      return -1;
    }
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
    for (let index = 0; index < gallery.length; index += 1) {
      if (normalizeComparableSrc(gallery[index]!.src) === normalizedSrc) {
        return index;
      }
    }
    return -1;
  }, [currentImageId, gallery, open, src]);

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
    const isStoredAttachmentSource = requiresAttachmentResolution(activeSrc);
    const immediateSrc = activeSrc === src && previewSrc
      ? previewSrc
      : isStoredAttachmentSource
        ? activeSrc
        : normalizeRenderableImageSrc(activeSrc) ?? TRANSPARENT_IMAGE_DATA_URL;
    setResolvedActiveSrc(immediateSrc);

    resolveViewerImageSource(activeSrc)
      .then((resolvedSrc) => {
        if (active) {
          setResolvedActiveSrc(resolvedSrc ?? TRANSPARENT_IMAGE_DATA_URL);
        }
      })
      .catch(() => {
        if (active) {
          setResolvedActiveSrc(TRANSPARENT_IMAGE_DATA_URL);
        }
      });

    return () => {
      active = false;
    };
  }, [activeSrc, open, previewSrc, src]);

  useEffect(() => {
    if (!open || !gallery || activeGalleryIndex < 0) {
      return;
    }

    warmViewerImageSource(gallery[activeGalleryIndex - 1]?.src);
    warmViewerImageSource(gallery[activeGalleryIndex + 1]?.src);
  }, [activeGalleryIndex, gallery, open]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (!open) {
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
  }, [open]);

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
    const viewportAspect = viewportSize.width / Math.max(viewportSize.height, themeChatImageViewerTokens.minViewportSizePx);
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
        targetWidth / Math.max(fitWidthAtZoomOne, themeChatImageViewerTokens.minViewportSizePx),
        targetHeight / Math.max(fitHeightAtZoomOne, themeChatImageViewerTokens.minViewportSizePx)
      )
    );
    const minZoom = Math.max(MIN_ZOOM, Number((initialZoom * themeChatImageViewerTokens.previewMinZoomScale).toFixed(2)));
    return {
      initialZoom,
      minZoom,
    };
  }, [aspectRatio, imageSize?.height, imageSize?.width, mediaSize, viewportSize.height, viewportSize.width]);
  const cropperViewportSize = useMemo(
    () => ({
      width: Math.max(themeChatImageViewerTokens.minViewportSizePx, viewportSize.width),
      height: Math.max(themeChatImageViewerTokens.minViewportSizePx, viewportSize.height),
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

    const safeAspect = aspectRatio > 0 ? aspectRatio : themeChatImageViewerTokens.minViewportSizePx;
    const viewportAspect = viewportSize.width / Math.max(viewportSize.height, themeChatImageViewerTokens.minViewportSizePx);
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
    return () => {
      document.removeEventListener("pointerdown", handleDocumentPress, true);
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
    setCrop({ x: themeCropperTokens.defaultCropX, y: themeCropperTokens.defaultCropY });
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
    const timer = window.setTimeout(() => setCopied(false), themeChatImageViewerTokens.copiedResetDelayMs);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const handleCopy = async () => {
    try {
      setCopied(await copyImageOrUrl(activeSrc));
    } catch {
      setCopied(false);
    }
  };

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={activeAlt || "Image preview"}
        className="fixed inset-0 z-[var(--vlaina-z-121)]"
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
            "absolute right-12 top-12 z-[var(--vlaina-z-10)] inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--vlaina-color-text-soft)] transition-all hover:bg-[var(--vlaina-hover)] hover:text-[var(--vlaina-color-text-strong)]",
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
          <div className="absolute inset-y-0 left-4 z-[var(--vlaina-z-10)] flex items-center">
            <button
              type="button"
              aria-label={t('chat.previousImage')}
              data-no-focus-input="true"
              data-chat-image-viewer-control="true"
              className={cn(
                "inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--vlaina-color-panel-border)] bg-[var(--vlaina-color-setting-field)] text-[var(--vlaina-color-text-strong)] shadow-[var(--vlaina-shadow-floating-panel)] transition-colors hover:bg-[var(--vlaina-color-setting-field)]",
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
          <div className="absolute inset-y-0 right-4 z-[var(--vlaina-z-10)] flex items-center">
            <button
              type="button"
              aria-label={t('chat.nextImage')}
              data-no-focus-input="true"
              data-chat-image-viewer-control="true"
              className={cn(
                "inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--vlaina-color-panel-border)] bg-[var(--vlaina-color-setting-field)] text-[var(--vlaina-color-text-strong)] shadow-[var(--vlaina-shadow-floating-panel)] transition-colors hover:bg-[var(--vlaina-color-setting-field)]",
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
              "absolute inset-0 transition-opacity duration-[var(--vlaina-duration-100)]",
              mediaReady ? "opacity-[var(--vlaina-opacity-100)]" : "opacity-[var(--vlaina-opacity-0)]"
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
              zoomSpeed={ZOOM_STEP}
              restrictPosition={false}
              objectFit="contain"
              setImageRef={(ref) => {
                imageElementRef.current = ref.current;
              }}
              onMediaLoaded={(mediaSize) => {
                if (cropperImageSrc === TRANSPARENT_IMAGE_DATA_URL) {
                  return;
                }
                const width = mediaSize.naturalWidth || mediaSize.width || themeChatImageViewerTokens.minViewportSizePx;
                const height = mediaSize.naturalHeight || mediaSize.height || themeChatImageViewerTokens.minViewportSizePx;
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
                setCrop({ x: themeCropperTokens.defaultCropX, y: themeCropperTokens.defaultCropY });
                setZoom(nextZoom);
                setMediaReady(true);
              }}
              onCropChange={setCrop}
              onZoomChange={(value) => setZoom(clampZoom(value))}
              style={{
                containerStyle: { backgroundColor: themeStyleResetTokens.backgroundTransparent },
                cropAreaStyle: {
                  border: themeStyleResetTokens.borderNone,
                  boxShadow: themeStyleResetTokens.boxShadowNone,
                  color: themeStyleResetTokens.colorTransparent,
                  outline: themeStyleResetTokens.outlineNone,
                  background: themeStyleResetTokens.backgroundTransparent,
                  pointerEvents: themeStyleResetTokens.pointerEventsNone,
                },
              }}
            />
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-3 z-[var(--vlaina-z-10)] flex justify-center">
            <div
              data-chat-image-viewer-control="true"
              className={cn(
                "pointer-events-auto inline-flex items-center gap-1 rounded-full px-2 py-2 text-[var(--vlaina-color-text-strong)]",
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
              <span className="min-w-[var(--vlaina-size-50px)] px-1.5 text-center text-xs font-semibold tabular-nums text-[var(--vlaina-color-text-strong)]">
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
              <div className="mx-1 h-6 w-px bg-[var(--vlaina-border)]" />
              {imageSizeLabel && (
                <span className="min-w-[var(--vlaina-size-78px)] px-3 text-center text-[var(--vlaina-font-11)] font-medium tabular-nums text-[var(--vlaina-color-text-soft)]">
                  {imageSizeLabel}
                </span>
              )}
              <div className="mx-1 h-6 w-px bg-[var(--vlaina-border)]" />
              <button
                type="button"
                aria-label={t('chat.copyImage')}
                data-no-focus-input="true"
                data-action="copy"
                className={cn(
                  imageViewerToolbarButtonClass,
                  iconButtonStyles,
                  copied && "text-[var(--vlaina-accent)] bg-[var(--vlaina-accent-soft)]"
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
