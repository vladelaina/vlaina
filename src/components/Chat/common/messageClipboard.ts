import { stripErrorTags } from '@/lib/ai/errorTag';
import { stripThinkingContent } from '@/lib/ai/stripThinkingContent';
import { stripWebSearchStatusMarkup } from '@/lib/ai/webSearch/statusMarkup';
import { writeTextToClipboard } from '@/lib/clipboard';
import { getElectronBridge } from '@/lib/electron/bridge';
import { convertToBase64, type Attachment } from '@/lib/storage/attachmentStorage';
import { normalizeRenderableImageSrc } from '@/components/common/markdown/imagePolicy';
import {
  parseHtmlImageTokens,
  parseMarkdownImageTokens,
  stripImageTokens,
  type ImageToken,
} from './messageImageTokens';

function normalizeImageToken(token: ImageToken): ImageToken | null {
  const src = normalizeRenderableImageSrc(token.src);
  return src ? { ...token, src } : null;
}

function normalizeImageTokens(tokens: ImageToken[]): ImageToken[] {
  return tokens
    .map(normalizeImageToken)
    .filter((token): token is ImageToken => Boolean(token));
}

export function extractMarkdownImageSources(content: string): string[] {
  return normalizeImageTokens(parseMarkdownImageTokens(content))
    .map((token) => token.src)
    .filter((src): src is string => !!src);
}

export function extractMessageImageSources(content: string): string[] {
  const tokens = normalizeImageTokens([...parseMarkdownImageTokens(content), ...parseHtmlImageTokens(content)]).sort(
    (a, b) => a.start - b.start
  );

  return tokens.map((token) => token.src).filter((src): src is string => !!src);
}

export function stripMarkdownImageTokens(content: string): string {
  return stripImageTokens(content, normalizeImageTokens(parseMarkdownImageTokens(content)));
}

export function stripMessageImageTokens(content: string): string {
  const tokens = normalizeImageTokens([...parseMarkdownImageTokens(content), ...parseHtmlImageTokens(content)]).sort(
    (a, b) => a.start - b.start
  );
  return stripImageTokens(content, tokens);
}

export function formatMessageCopyText(content: string): string {
  const normalizedContent = stripThinkingContent(stripWebSearchStatusMarkup(stripErrorTags(content)));
  const tokens = normalizeImageTokens(parseMarkdownImageTokens(normalizedContent));
  if (tokens.length === 0) {
    return normalizedContent;
  }

  const parts: string[] = [];
  let cursor = 0;
  for (const token of tokens) {
    parts.push(normalizedContent.slice(cursor, token.start));
    if (token.src) {
      parts.push(token.src.startsWith("data:image/") ? "[image]" : token.src);
    }
    cursor = token.end;
  }
  parts.push(normalizedContent.slice(cursor));
  return parts.join("");
}

export async function copyImageSourceToClipboard(src: string): Promise<boolean> {
  try {
    const resolvedSrc = await resolveClipboardImageSource(src);
    if (resolvedSrc.trim().startsWith("data:image/")) {
      const desktopClipboard = getElectronBridge()?.clipboard;
      if (desktopClipboard?.writeImage) {
        try {
          await desktopClipboard.writeImage(resolvedSrc);
          return true;
        } catch {
        }
      }
    }

    const response = await fetch(resolvedSrc);
    const blob = await response.blob();
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

async function resolveClipboardImageSource(src: string): Promise<string> {
  const trimmed = src.trim();
  if (!trimmed.startsWith("attachment://") && !trimmed.startsWith("app-file://attachment/")) {
    return src;
  }

  const attachment: Attachment = {
    id: "clipboard-image",
    path: "",
    previewUrl: trimmed,
    assetUrl: trimmed,
    name: "image",
    type: "image/png",
    size: 0,
  };
  return convertToBase64(attachment);
}

export async function copyMessageContentToClipboard(content: string): Promise<boolean> {
  const imageSources = extractMessageImageSources(content);
  if (imageSources.length > 0) {
    const copied = await copyImageSourceToClipboard(imageSources[0]);
    if (copied) {
      return true;
    }
  }

  return writeTextToClipboard(formatMessageCopyText(content));
}
