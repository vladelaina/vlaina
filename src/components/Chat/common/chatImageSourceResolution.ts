import { normalizeRenderableImageSrc } from '@/components/common/markdown/imagePolicy';
import { convertToBase64, createStoredAttachmentFromSource } from '@/lib/storage/attachmentStorage';
import { isSvgDataUrl, rasterizeSvgDataUrlToPng } from './svgRasterize';

export function normalizeDirectChatImageSource(src: string): string | null {
  if (isSvgDataUrl(src)) {
    return src.trim();
  }

  const safeSrc = normalizeRenderableImageSrc(src);
  if (!safeSrc) {
    return null;
  }

  const normalized = safeSrc.toLowerCase();
  if (
    normalized.startsWith('attachment:') ||
    normalized.startsWith('app-file:') ||
    normalized.startsWith('asset:')
  ) {
    return null;
  }

  return (
    normalized.startsWith('http://') ||
    normalized.startsWith('https://') ||
    normalized.startsWith('data:') ||
    normalized.startsWith('blob:')
  ) ? safeSrc : null;
}

export async function resolveSafeChatImageSource(src: string, id = 'chat-image'): Promise<string | null> {
  const trimmed = src.trim();
  if (!trimmed) {
    return null;
  }

  const attachment = createStoredAttachmentFromSource(trimmed, id);
  const resolved = attachment
    ? await convertToBase64(attachment).catch(() => null)
    : normalizeDirectChatImageSource(trimmed);
  if (!resolved) {
    return null;
  }

  const rasterized = isSvgDataUrl(resolved) ? await rasterizeSvgDataUrlToPng(resolved) : resolved;
  if (!rasterized) {
    return null;
  }

  return normalizeRenderableImageSrc(rasterized);
}
