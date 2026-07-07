import {
  parseMarkdownAndHtmlImageTokens,
  type ImageToken,
} from '@/components/Chat/common/messageImageTokens';
import { normalizeRenderableImageSrc } from '@/components/common/markdown/imagePolicy';
import { parseVideoUrl } from '@/lib/markdown/videoUrl';

export const MAX_LAYOUT_VIDEO_IMAGE_TOKENS = 2000;

export function getVideoImageTokens(markdown: string): ImageToken[] {
  return parseMarkdownAndHtmlImageTokens(markdown, { maxTokens: MAX_LAYOUT_VIDEO_IMAGE_TOKENS }).filter((token) => {
    const src = token.src ? normalizeRenderableImageSrc(token.src) : null;
    return !!src && !!parseVideoUrl(src);
  });
}

export function stripVideoImageTokens(markdown: string, videoTokens: ImageToken[]): string {
  return videoTokens
    .reduceRight((next, token) => `${next.slice(0, token.start)}${next.slice(token.end)}`, markdown);
}
