import { defaultUrlTransform } from 'react-markdown';
import { normalizeGithubUrl } from '@/lib/notes/markdown/githubHtmlPolicy';
import { sanitizeNoteLinkHref } from '@/lib/notes/markdown/urlSecurity';
import { normalizeRenderableImageSrc } from './imagePolicy';

const SAFE_RAW_MEDIA_SRC_SCHEMES = new Set(['http:', 'https:']);
const RAW_MEDIA_SRC_TAGS = new Set(['audio', 'iframe', 'source', 'track', 'video']);

function normalizeReadonlyRawMediaSrc(value: string): string | null {
  return normalizeGithubUrl(value, SAFE_RAW_MEDIA_SRC_SCHEMES, {
    allowPlainRelative: true,
    allowProtocolRelative: true,
    blockLocalNetwork: true,
  });
}

export function readonlyMarkdownUrlTransform(url: string, key: string, node?: { tagName?: string }): string {
  const tagName = typeof node?.tagName === 'string' ? node.tagName.toLowerCase() : '';

  if (key === 'src' && RAW_MEDIA_SRC_TAGS.has(tagName)) {
    return normalizeReadonlyRawMediaSrc(url) ?? '';
  }

  if (key === 'src' || key === 'poster') {
    return normalizeRenderableImageSrc(url) ?? '';
  }

  if (key === 'href' || key === 'cite') {
    return sanitizeNoteLinkHref(url) ?? '';
  }

  return defaultUrlTransform(url);
}
