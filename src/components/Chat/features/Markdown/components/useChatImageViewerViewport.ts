import { useEffect, useState } from "react";
import { themeChatImageViewerTokens } from "@/styles/themeTokens";
import type { ViewerSize } from "./chatImageViewerGeometry";

export function useChatImageViewerViewport(open: boolean): ViewerSize {
  const [viewportSize, setViewportSize] = useState<ViewerSize>({
    width: themeChatImageViewerTokens.defaultViewportWidthPx,
    height: themeChatImageViewerTokens.defaultViewportHeightPx,
  });

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

  return viewportSize;
}
