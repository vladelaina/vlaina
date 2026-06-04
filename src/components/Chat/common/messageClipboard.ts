import { stripErrorTags } from '@/lib/ai/errorTag';
import { stripThinkingContent } from '@/lib/ai/stripThinkingContent';
import { stripWebSearchStatusMarkup } from '@/lib/ai/webSearch/statusMarkup';
import { writeTextToClipboard } from '@/lib/clipboard';
import { getElectronBridge } from '@/lib/electron/bridge';
import { isRenderableDataImageSrc, normalizeRenderableImageSrc } from '@/components/common/markdown/imagePolicy';
import { parseVideoUrl } from '@/lib/markdown/videoUrl';
import { fetchChatImageBlob } from './chatImageFetch';
import { resolveSafeChatImageSource } from './chatImageSourceResolution';
import {
  parseMarkdownAndHtmlImageTokens,
  parseMarkdownImageTokens,
  stripImageTokens,
  type ImageToken,
} from './messageImageTokens';
import { isSvgImageMimeType, rasterizeSvgBlobToPngBlob } from './svgRasterize';

function normalizeImageToken(token: ImageToken): ImageToken | null {
  const src = normalizeRenderableImageSrc(token.src);
  return src ? { ...token, src } : null;
}

function normalizeImageTokens(tokens: ImageToken[]): ImageToken[] {
  return tokens
    .map(normalizeImageToken)
    .filter((token): token is ImageToken => Boolean(token));
}

function normalizeRenderedImageTokens(tokens: ImageToken[]): ImageToken[] {
  return normalizeImageTokens(tokens).filter((token) => !!token.src && isRenderedImageSource(token.src));
}

export function extractMarkdownImageSources(content: string): string[] {
  return normalizeImageTokens(parseMarkdownImageTokens(content))
    .map((token) => token.src)
    .filter((src): src is string => !!src);
}

export function extractMessageImageSources(content: string): string[] {
  const tokens = normalizeImageTokens(parseMarkdownAndHtmlImageTokens(content));

  return tokens.map((token) => token.src).filter((src): src is string => !!src);
}

export function isRenderedImageSource(src: string): boolean {
  return !parseVideoUrl(src);
}

export function extractRenderedMarkdownImageSources(content: string): string[] {
  return extractMarkdownImageSources(content).filter(isRenderedImageSource);
}

export function extractRenderedMessageImageSources(content: string): string[] {
  return extractMessageImageSources(content).filter(isRenderedImageSource);
}

export function stripMarkdownImageTokens(content: string): string {
  return stripImageTokens(content, normalizeRenderedImageTokens(parseMarkdownImageTokens(content)));
}

export function stripMessageImageTokens(content: string): string {
  const tokens = normalizeRenderedImageTokens(parseMarkdownAndHtmlImageTokens(content));
  return stripImageTokens(content, tokens);
}

export function formatMessageCopyText(content: string): string {
  const normalizedContent = stripThinkingContent(stripWebSearchStatusMarkup(stripErrorTags(content)));
  const tokens = normalizeImageTokens(parseMarkdownAndHtmlImageTokens(normalizedContent));
  if (tokens.length === 0) {
    return normalizedContent;
  }

  const parts: string[] = [];
  let cursor = 0;
  for (const token of tokens) {
    parts.push(normalizedContent.slice(cursor, token.start));
    if (token.src) {
      parts.push(isRenderableDataImageSrc(token.src) ? "[image]" : token.src);
    }
    cursor = token.end;
  }
  parts.push(normalizedContent.slice(cursor));
  return parts.join("");
}

export async function copyImageSourceToClipboard(src: string): Promise<boolean> {
  try {
    const resolvedSrc = await resolveSafeChatImageSource(src, "clipboard-image");
    if (!resolvedSrc) {
      return false;
    }
    if (isRenderableDataImageSrc(resolvedSrc)) {
      const desktopClipboard = getElectronBridge()?.clipboard;
      if (desktopClipboard?.writeImage) {
        try {
          await desktopClipboard.writeImage(resolvedSrc);
          return true;
        } catch {
        }
      }
    }

    let blob = await fetchChatImageBlob(resolvedSrc);
    if (!blob) {
      return false;
    }
    if (isSvgImageMimeType(blob.type)) {
      const rasterizedBlob = await rasterizeSvgBlobToPngBlob(blob);
      if (!rasterizedBlob) {
        return false;
      }
      blob = rasterizedBlob;
    }
    const ClipboardItemCtor = (window as any).ClipboardItem;
    if (ClipboardItemCtor && blob.type.startsWith("image/")) {
      const item = new ClipboardItemCtor({ [blob.type]: blob });
      await navigator.clipboard.write([item]);
      return true;
    }
  } catch {
  }
  return false;
}

export async function copyMessageContentToClipboard(content: string): Promise<boolean> {
  const imageSources = extractRenderedMessageImageSources(content);
  if (imageSources.length > 0) {
    const copied = await copyImageSourceToClipboard(imageSources[0]);
    if (copied) {
      return true;
    }
  }

  return writeTextToClipboard(formatMessageCopyText(content));
}
