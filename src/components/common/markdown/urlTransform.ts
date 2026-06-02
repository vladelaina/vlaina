import { defaultUrlTransform } from 'react-markdown';
import { sanitizeNoteLinkHref } from '@/lib/notes/markdown/urlSecurity';
import { normalizeRenderableImageSrc } from './imagePolicy';

export function readonlyMarkdownUrlTransform(url: string, key: string): string {
  if (key === 'src') {
    return normalizeRenderableImageSrc(url) ?? '';
  }

  if (key === 'href') {
    return sanitizeNoteLinkHref(url) ?? '';
  }

  return defaultUrlTransform(url);
}
