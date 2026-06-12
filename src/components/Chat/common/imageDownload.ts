import { writeDesktopBinaryFile } from "@/lib/desktop/fs";
import { translate } from "@/lib/i18n/runtime";
import { saveDialog } from "@/lib/storage/dialog";
import { fetchChatImageBlobResult, MAX_CHAT_IMAGE_FETCH_BYTES } from "./chatImageFetch";
import { resolveSafeChatImageSource } from "./chatImageSourceResolution";
import { isSvgImageMimeType, rasterizeSvgBlobToPngBlob } from "./svgRasterize";

const IMAGE_EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/bmp": "bmp",
};
const RASTER_IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "gif", "bmp"]);
const MAX_DOWNLOAD_FILENAME_STEM_CHARS = 180;

function sanitizeFileStem(value: string): string {
  const trimmed = value.trim();
  const normalized = trimmed.replace(/[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069\uFFFD<>:"/\\|?*]+/g, "_");
  return normalized ? normalized.slice(0, MAX_DOWNLOAD_FILENAME_STEM_CHARS) : "image";
}

function buildTimestampStem(): string {
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `vlaina-${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
}

function extensionFromSource(src: string): string | null {
  try {
    const parsed = new URL(src);
    const filename = parsed.pathname.split("/").pop() || "";
    const ext = filename.split(".").pop()?.toLowerCase();
    return ext || null;
  } catch {
    const filename = src.split(/[?#]/)[0].split("/").pop() || "";
    const ext = filename.split(".").pop()?.toLowerCase();
    return ext || null;
  }
}

function resolveFilename(alt: string | undefined, src: string, blobType: string): string {
  const normalizedAlt = sanitizeFileStem(alt || "");
  const base = normalizedAlt.toLowerCase() === "image" || normalizedAlt === ""
    ? buildTimestampStem()
    : normalizedAlt;
  const mimeExt = IMAGE_EXT_BY_MIME[blobType] || null;
  const srcExt = extensionFromSource(src);
  const ext = (mimeExt || srcExt || "png").replace(/^\./, "");
  if (base.toLowerCase().endsWith(`.${ext.toLowerCase()}`)) {
    return base;
  }
  return `${base}.${ext}`;
}

async function downloadViaAnchor(src: string, filename: string): Promise<void> {
  const link = document.createElement("a");
  link.href = src;
  link.download = filename;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

async function readBlobBytes(blob: Blob): Promise<Uint8Array> {
  if (typeof blob.arrayBuffer === "function") {
    return new Uint8Array(await blob.arrayBuffer());
  }

  return await new Promise<Uint8Array>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (result instanceof ArrayBuffer) {
        resolve(new Uint8Array(result));
        return;
      }
      reject(new Error("Unable to read image blob."));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Unable to read image blob."));
    reader.onabort = () => reject(new Error("Image blob read was aborted."));
    reader.readAsArrayBuffer(blob);
  });
}

function isBlobByteLengthWithinLimit(size: number, maxBytes: number): boolean {
  return Number.isFinite(size) && size >= 0 && size <= maxBytes;
}

function isRasterImageExtension(extension: string | null | undefined): boolean {
  return RASTER_IMAGE_EXTENSIONS.has((extension || "").replace(/^\./, "").toLowerCase());
}

export async function downloadImageWithPrompt(src: string, alt?: string): Promise<void> {
  const resolvedSrc = await resolveSafeChatImageSource(src, "download-image");
  if (!resolvedSrc) {
    return;
  }

  let blob: Blob | null = null;
  try {
    const result = await fetchChatImageBlobResult(resolvedSrc);
    if (result.status === "too-large") {
      return;
    }
    blob = result.blob;
  } catch {
    blob = null;
  }

  if (blob && isSvgImageMimeType(blob.type)) {
    blob = await rasterizeSvgBlobToPngBlob(blob);
    if (!blob || !isBlobByteLengthWithinLimit(blob.size, MAX_CHAT_IMAGE_FETCH_BYTES)) {
      return;
    }
  }

  const filename = resolveFilename(alt, src, blob?.type || "");
  const sourceExt = extensionFromSource(src)?.toLowerCase() || extensionFromSource(resolvedSrc)?.toLowerCase();
  const shouldSaveBlobWithoutMime = !!blob && !blob.type && isRasterImageExtension(sourceExt);

  if (blob?.type.startsWith("image/") || shouldSaveBlobWithoutMime) {
    if (!isBlobByteLengthWithinLimit(blob.size, MAX_CHAT_IMAGE_FETCH_BYTES)) {
      return;
    }
    const defaultExt = filename.split(".").pop()?.toLowerCase() || "png";
    const extensions = Array.from(
      new Set([defaultExt, "png", "jpg", "jpeg", "webp", "gif", "bmp"])
    );
    const filePath = await saveDialog({
      title: translate('chat.saveImage'),
      defaultPath: filename,
      filters: [{ name: "Images", extensions }],
    });
    if (!filePath) {
      return;
    }
    await writeDesktopBinaryFile(filePath, await readBlobBytes(blob));
    return;
  }

  if (blob || sourceExt === "svg") {
    return;
  }

  await downloadViaAnchor(resolvedSrc, filename);
}
