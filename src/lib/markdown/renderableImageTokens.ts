import { normalizeRenderableImageSrc } from './renderableImagePolicy';
import {
  parseMarkdownAndHtmlImageTokens,
  parseMarkdownImageTokens,
  replaceImageTokens,
  type ImageToken,
} from './markdownImageTokens';
import { parseVideoUrl } from './videoUrl';

const MAX_RENDERABLE_IMAGE_REPLACEMENT_TOKENS = 2000;

function normalizeImageToken(token: ImageToken): ImageToken | null {
  const src = normalizeRenderableImageSrc(token.src);
  return src ? { ...token, src } : null;
}

function normalizeImageTokens(tokens: ImageToken[]): ImageToken[] {
  return tokens
    .map(normalizeImageToken)
    .filter((token): token is ImageToken => token !== null && token.src !== null && !parseVideoUrl(token.src));
}

export function replaceRenderableMarkdownImageTokens(content: string, replacement: string): string {
  return replaceImageTokens(
    content,
    normalizeImageTokens(parseMarkdownImageTokens(content, { maxTokens: MAX_RENDERABLE_IMAGE_REPLACEMENT_TOKENS })),
    replacement
  );
}

export function replaceRenderableMessageImageTokens(content: string, replacement: string): string {
  return replaceImageTokens(
    content,
    normalizeImageTokens(parseMarkdownAndHtmlImageTokens(content, { maxTokens: MAX_RENDERABLE_IMAGE_REPLACEMENT_TOKENS })),
    replacement
  );
}

export function stripRenderableMarkdownImageTokens(content: string): string {
  return replaceRenderableMarkdownImageTokens(content, '');
}
