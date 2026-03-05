import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Cropper from "react-easy-crop";
import { Icon } from "@/components/ui/icons";
import { cn, iconButtonStyles } from "@/lib/utils";
import { copyImageSourceToClipboard } from "@/components/Chat/common/messageClipboard";

interface ChatImageViewerProps {
  open: boolean;
  src: string;
  alt?: string;
  onOpenChange: (open: boolean) => void;
}

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.12;

function downloadImageByUrl(src: string, alt?: string) {
  const fallbackName = (alt || "image").trim() || "image";
  const fileName = fallbackName.replace(/[<>:"/\\|?*]+/g, "_");
  const link = document.createElement("a");
  link.href = src;
  link.download = fileName;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

async function copyImageOrUrl(src: string): Promise<void> {
  const copied = await copyImageSourceToClipboard(src);
  if (copied) {
    return;
  }
  await navigator.clipboard.writeText(src);
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

export function ChatImageViewer({ open, src, alt, onOpenChange }: ChatImageViewerProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [copied, setCopied] = useState(false);
  const [aspectRatio, setAspectRatio] = useState(1);
  const [viewportSize, setViewportSize] = useState({ width: 1440, height: 900 });

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
    };
    image.onerror = () => {
      if (!active) {
        return;
      }
      setAspectRatio(1);
    };
    image.src = src;
    return () => {
      active = false;
    };
  }, [open, src]);

  useEffect(() => {
    if (!open || typeof window === "undefined") {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onOpenChange]);

  const percentLabel = useMemo(() => `${Math.round(zoom * 100)}%`, [zoom]);
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
  }, [open, previewMetrics.initialZoom, src]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1200);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const handleCopy = async () => {
    try {
      await copyImageOrUrl(src);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  if (!isMounted || !open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt || "Image preview"}
      className="fixed inset-0 z-[120] bg-white/70"
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

      <div className="relative h-full w-full">
        <div className="absolute inset-0">
          <Cropper
            image={src}
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
          <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-black/45 px-2 py-1.5 text-white/90 backdrop-blur-sm">
            <button
              type="button"
              aria-label="Zoom out"
              data-no-focus-input="true"
              className={cn("p-1", iconButtonStyles, "text-white/90 hover:text-white")}
              onClick={() => setZoom((value) => clampZoom(value - ZOOM_STEP))}
            >
              <Icon name="common.remove" size="md" />
            </button>
            <span className="min-w-[52px] text-center text-xs font-medium tabular-nums">{percentLabel}</span>
            <button
              type="button"
              aria-label="Zoom in"
              data-no-focus-input="true"
              className={cn("p-1", iconButtonStyles, "text-white/90 hover:text-white")}
              onClick={() => setZoom((value) => clampZoom(value + ZOOM_STEP))}
            >
              <Icon name="common.add" size="md" />
            </button>
            <button
              type="button"
              aria-label="Copy image"
              data-no-focus-input="true"
              className={cn("p-1", iconButtonStyles, "text-white/90 hover:text-white")}
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
              className={cn("p-1", iconButtonStyles, "text-white/90 hover:text-white")}
              onClick={() => {
                downloadImageByUrl(src, alt);
              }}
            >
              <Icon name="common.download" size="md" />
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
