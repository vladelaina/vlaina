import { normalizeRenderableImageSrc } from '@/components/common/markdown/imagePolicy';
import { convertToBase64, createStoredAttachmentFromSource } from '@/lib/storage/attachmentStorage';
import { isSvgDataUrl, rasterizeSvgDataUrlToPng } from './svgRasterize';

export async function resolveSafeChatImageSource(src: string, id = 'chat-image'): Promise<string | null> {
  const trimmed = src.trim();
  if (!trimmed) {
    return null;
  }

  const attachment = createStoredAttachmentFromSource(trimmed, id);
  const resolved = attachment ? await convertToBase64(attachment).catch(() => null) : trimmed;
  if (!resolved) {
    return null;
  }

  const rasterized = isSvgDataUrl(resolved) ? await rasterizeSvgDataUrlToPng(resolved) : resolved;
  if (!rasterized) {
    return null;
  }

  return normalizeRenderableImageSrc(rasterized);
}
