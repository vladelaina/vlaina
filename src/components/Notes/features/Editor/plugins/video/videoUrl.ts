import { logVideoDebug } from './videoDebug';

const MAX_VIDEO_URL_LENGTH = 2048;

export type ParsedVideoUrl =
  | { type: 'youtube' | 'bilibili'; embedUrl: string }
  | { type: 'direct'; embedUrl: string };

export type IframeVideoUrl = Extract<ParsedVideoUrl, { type: 'youtube' | 'bilibili' }>;

export function normalizeVideoUrlInput(input: string) {
  const url = input.trim();
  if (!url || url.length > MAX_VIDEO_URL_LENGTH || /[\r\n]/.test(url)) {
    return null;
  }
  return url;
}

function buildBilibiliEmbedUrl(args: {
  bvid: string;
  aid?: number;
  cid?: number;
  page?: number;
}) {
  const params = new URLSearchParams({
    isOutside: 'true',
    bvid: args.bvid,
    p: String(args.page ?? 1),
    danmaku: '0',
    autoplay: '0',
  });

  if (typeof args.aid === 'number' && Number.isFinite(args.aid)) {
    params.set('aid', String(args.aid));
  }

  if (typeof args.cid === 'number' && Number.isFinite(args.cid)) {
    params.set('cid', String(args.cid));
  }

  return `https://player.bilibili.com/player.html?${params.toString()}`;
}

function extractBilibiliBvid(url: string) {
  return url.match(/bilibili\.com\/video\/(BV[a-zA-Z0-9]+)/)?.[1]
    ?? url.match(/[?&]bvid=(BV[a-zA-Z0-9]+)/)?.[1]
    ?? null;
}

function parsePositiveNumber(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function extractYouTubeVideoId(rawUrl: string) {
  try {
    const parsedUrl = new URL(rawUrl);
    const hostname = parsedUrl.hostname.replace(/^www\./, '');
    if (hostname === 'youtu.be') {
      return parsedUrl.pathname.split('/').filter(Boolean)[0] ?? null;
    }
    if (hostname === 'youtube.com' || hostname === 'youtube-nocookie.com') {
      const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
      if (pathParts[0] === 'watch') {
        return parsedUrl.searchParams.get('v');
      }
      if (pathParts[0] === 'embed' || pathParts[0] === 'shorts' || pathParts[0] === 'live') {
        return pathParts[1] ?? null;
      }
    }
  } catch {
    return null;
  }
  return null;
}

export function parseVideoUrl(url: string): ParsedVideoUrl | null {
  url = normalizeVideoUrlInput(url) ?? '';
  if (!url) return null;

  const youtubeVideoId = extractYouTubeVideoId(url);
  if (youtubeVideoId?.match(/^[a-zA-Z0-9_-]{11}$/)) {
    return {
      type: 'youtube',
      embedUrl: `https://www.youtube.com/embed/${youtubeVideoId}?autoplay=0&playsinline=1&rel=0`,
    };
  }

  const bilibiliBvid = extractBilibiliBvid(url);
  if (bilibiliBvid) {
    let page: number | null = null;
    try {
      const parsedUrl = new URL(url);
      const cid = parsePositiveNumber(parsedUrl.searchParams.get('cid'));
      const aid = parsePositiveNumber(parsedUrl.searchParams.get('aid'));
      page = parsePositiveNumber(parsedUrl.searchParams.get('p') ?? parsedUrl.searchParams.get('page'));
      if (parsedUrl.hostname === 'player.bilibili.com' && cid) {
        return {
          type: 'bilibili',
          embedUrl: buildBilibiliEmbedUrl({
            bvid: bilibiliBvid,
            aid: aid ?? undefined,
            cid,
            page: page ?? undefined,
          }),
        };
      }
    } catch {
      // Fall through to the bvid-only embed URL.
    }

    return {
      type: 'bilibili',
      embedUrl: buildBilibiliEmbedUrl({ bvid: bilibiliBvid, page: page ?? undefined }),
    };
  }

  if (url.match(/\.(mp4|webm|ogg)(\?.*)?$/i)) {
    return {
      type: 'direct',
      embedUrl: url,
    };
  }

  return null;
}

export function isSupportedVideoUrl(url: string) {
  const parsed = parseVideoUrl(url);
  if (!parsed) {
    logVideoDebug('validate_unsupported', {
      url,
      supported: false,
    });
  }
  return parsed !== null;
}
