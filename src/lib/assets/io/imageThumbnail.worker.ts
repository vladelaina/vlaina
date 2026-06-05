interface ThumbnailRequest {
  buffer: ArrayBuffer;
  mimeType: string;
  maxEdgePx: number;
}

const DEFAULT_THUMBNAIL_MAX_EDGE_PX = 160;
const MAX_THUMBNAIL_MAX_EDGE_PX = 2048;

type ThumbnailResponse =
  | { ok: true; blob: Blob }
  | { ok: false; message: string };

const workerScope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<ThumbnailRequest>) => void) | null;
  postMessage: (message: ThumbnailResponse) => void;
};

workerScope.onmessage = async (event) => {
  try {
    const { buffer, mimeType } = event.data;
    const roundedMaxEdgePx = Math.round(event.data.maxEdgePx);
    const maxEdgePx = Number.isFinite(roundedMaxEdgePx)
      ? Math.max(1, Math.min(MAX_THUMBNAIL_MAX_EDGE_PX, roundedMaxEdgePx))
      : DEFAULT_THUMBNAIL_MAX_EDGE_PX;
    if (typeof createImageBitmap !== 'function' || typeof OffscreenCanvas === 'undefined') {
      throw new Error('Worker thumbnail APIs are unavailable');
    }

    const sourceBlob = new Blob([buffer], { type: mimeType });
    const bitmap = await createImageBitmap(sourceBlob);
    const scale = Math.min(1, maxEdgePx / Math.max(bitmap.width || 1, bitmap.height || 1));
    const width = Math.max(1, Math.round((bitmap.width || 1) * scale));
    const height = Math.max(1, Math.round((bitmap.height || 1) * scale));
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) {
      throw new Error('Worker canvas is unavailable');
    }

    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();
    const thumbnailBlob = await canvas.convertToBlob({ type: 'image/webp', quality: 0.82 });
    workerScope.postMessage({ ok: true, blob: thumbnailBlob });
  } catch (error) {
    workerScope.postMessage({
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    });
  }
};

export {};
