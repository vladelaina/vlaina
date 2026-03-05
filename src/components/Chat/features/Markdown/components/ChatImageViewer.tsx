import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Cropper from "react-easy-crop";
import { Icon } from "@/components/ui/icons";
import { cn, iconButtonStyles } from "@/lib/utils";

interface ChatImageViewerProps {
  open: boolean;
  src: string;
  alt?: string;
  onOpenChange: (open: boolean) => void;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.25;

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

  useEffect(() => {
    setIsMounted(true);
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
    if (!open) {
      return;
    }
    setCrop({ x: 0, y: 0 });
    setZoom(1);
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

  if (!isMounted || !open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt || "Image preview"}
      className="fixed inset-0 z-[120] bg-black/35"
      data-no-focus-input="true"
      onClick={() => onOpenChange(false)}
    >
      <div className="relative h-full w-full" onClick={(event) => event.stopPropagation()}>
        <div className="absolute inset-0">
          <Cropper
            image={src}
            crop={crop}
            zoom={zoom}
            minZoom={MIN_ZOOM}
            maxZoom={MAX_ZOOM}
            showGrid={false}
            zoomWithScroll={true}
            restrictPosition={true}
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

        <button
          type="button"
          aria-label="Close preview"
          data-no-focus-input="true"
          className={cn(
            "absolute right-4 top-4 z-10 p-1.5 text-white/90 hover:text-white",
            iconButtonStyles
          )}
          onClick={() => onOpenChange(false)}
        >
          <Icon name="common.close" size="md" />
        </button>

        <div className="pointer-events-none absolute inset-x-0 bottom-6 z-10 flex justify-center">
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
              aria-label="Reset zoom"
              data-no-focus-input="true"
              className={cn("p-1", iconButtonStyles, "text-white/90 hover:text-white")}
              onClick={() => {
                setCrop({ x: 0, y: 0 });
                setZoom(1);
              }}
            >
              <Icon name="common.refresh" size="md" />
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
