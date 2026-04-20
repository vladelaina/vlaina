import { writeDesktopBinaryFile } from "@/lib/desktop/fs";
import { saveDialog } from "@/lib/storage/dialog";

const IMAGE_EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/bmp": "bmp",
  "image/svg+xml": "svg",
};

function sanitizeFileStem(value: string): string {
  const trimmed = value.trim();
  const normalized = trimmed.replace(/[<>:"/\\|?*]+/g, "_");
  return normalized || "image";
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

export async function downloadImageWithPrompt(src: string, alt?: string): Promise<void> {
  let blob: Blob | null = null;
  try {
    const response = await fetch(src);
    blob = await response.blob();
  } catch {
    blob = null;
  }

  const filename = resolveFilename(alt, src, blob?.type || "");

  if (blob) {
    const defaultExt = filename.split(".").pop()?.toLowerCase() || "png";
    const extensions = Array.from(
      new Set([defaultExt, "png", "jpg", "jpeg", "webp", "gif", "bmp", "svg"])
    );
    const filePath = await saveDialog({
      title: "Save image",
      defaultPath: filename,
      filters: [{ name: "Images", extensions }],
    });
    if (!filePath) {
      return;
    }
    await writeDesktopBinaryFile(filePath, new Uint8Array(await blob.arrayBuffer()));
    return;
  }

  await downloadViaAnchor(src, filename);
}
