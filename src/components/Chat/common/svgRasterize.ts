const SVG_RASTERIZE_TIMEOUT_MS = 2500;

function decodeSvgDataUrl(dataUrl: string): string | null {
  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex < 0) {
    return null;
  }
  const meta = dataUrl.slice(0, commaIndex);
  const payload = dataUrl.slice(commaIndex + 1);
  try {
    if (/;base64/i.test(meta)) {
      return window.atob(payload);
    }
    return decodeURIComponent(payload);
  } catch {
    return null;
  }
}

function pickSvgRenderSize(svgText: string): { width: number; height: number } {
  const clamp = (value: number) => Math.max(1, Math.min(4096, Math.round(value)));
  const parsePositive = (value: string | undefined) => {
    if (!value) return null;
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };

  const widthMatch = /\bwidth=["']\s*([0-9.]+)(?:px)?\s*["']/i.exec(svgText);
  const heightMatch = /\bheight=["']\s*([0-9.]+)(?:px)?\s*["']/i.exec(svgText);
  const widthFromAttr = parsePositive(widthMatch?.[1]);
  const heightFromAttr = parsePositive(heightMatch?.[1]);
  if (widthFromAttr && heightFromAttr) {
    return { width: clamp(widthFromAttr), height: clamp(heightFromAttr) };
  }

  const viewBoxMatch = /\bviewBox=["']\s*[-0-9.]+\s+[-0-9.]+\s+([0-9.]+)\s+([0-9.]+)\s*["']/i.exec(svgText);
  const widthFromViewBox = parsePositive(viewBoxMatch?.[1]);
  const heightFromViewBox = parsePositive(viewBoxMatch?.[2]);
  if (widthFromViewBox && heightFromViewBox) {
    return { width: clamp(widthFromViewBox), height: clamp(heightFromViewBox) };
  }

  return { width: 1024, height: 1024 };
}

export function isSvgDataUrl(value: string): boolean {
  return value.trim().toLowerCase().startsWith('data:image/svg+xml');
}

export function rasterizeSvgDataUrlToPng(dataUrl: string): Promise<string | null> {
  if (!isSvgDataUrl(dataUrl)) {
    return Promise.resolve(dataUrl);
  }
  if (typeof window === 'undefined' || typeof Image === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve(null);
  }

  const svgText = decodeSvgDataUrl(dataUrl);
  const { width, height } = pickSvgRenderSize(svgText ?? '');

  return new Promise((resolve) => {
    let settled = false;
    const timeout = window.setTimeout(() => finish(null), SVG_RASTERIZE_TIMEOUT_MS);
    const finish = (value: string | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      resolve(value);
    };

    const image = new Image();
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          finish(null);
          return;
        }
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(image, 0, 0, width, height);
        finish(canvas.toDataURL('image/png'));
      } catch {
        finish(null);
      }
    };
    image.onerror = () => finish(null);
    image.src = dataUrl;
  });
}
