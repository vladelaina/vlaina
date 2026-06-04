import { normalizeRenderableImageSrc } from './renderableImagePolicy';
import {
  parseMarkdownImageTokens,
  replaceImageTokens,
  type ImageToken,
} from './markdownImageTokens';
import { parseVideoUrl } from './videoUrl';

function normalizeImageToken(token: ImageToken): ImageToken | null {
  const src = normalizeRenderableImageSrc(token.src);
  return src ? { ...token, src } : null;
}

function normalizeImageTokens(tokens: ImageToken[]): ImageToken[] {
  return tokens
    .map(normalizeImageToken)
    .filter((token): token is ImageToken => Boolean(token) && !!token.src && !parseVideoUrl(token.src));
}

export function replaceRenderableMarkdownImageTokens(content: string, replacement: string): string {
  return replaceImageTokens(content, normalizeImageTokens(parseMarkdownImageTokens(content)), replacement);
}

export function stripRenderableMarkdownImageTokens(content: string): string {
  return replaceRenderableMarkdownImageTokens(content, '');
}
