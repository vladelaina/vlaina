import type { VideoAttrs } from './types';
import { parseVideoUrl } from './videoUrl';

export function getVideoAttrsDebug(attrs: VideoAttrs) {
  const src = attrs.src || '';
  const parsed = src ? parseVideoUrl(src) : null;
  return {
    src,
    title: attrs.title,
    width: attrs.width,
    height: attrs.height,
    parsedType: parsed?.type ?? null,
    embedUrl: parsed?.embedUrl ?? null,
    hasAid: src.includes('aid='),
    hasCid: src.includes('cid='),
  };
}
