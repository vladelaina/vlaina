import { isLocalNetworkHttpUrl } from '@/lib/notes/markdown/urlSecurity';

const MAX_VIDEO_URL_LENGTH = 2048;
const MAX_VIDEO_NUMERIC_PARAM_LENGTH = 32;
const UNSAFE_VIDEO_URL_CHARS_REGEX = /[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069\uFFFD]/;

export type ParsedVideoUrl =
  | { type: 'youtube' | 'bilibili'; embedUrl: string }
  | { type: 'direct'; embedUrl: string };

export type IframeVideoUrl = Extract<ParsedVideoUrl, { type: 'youtube' | 'bilibili' }>;

export function normalizeVideoUrlInput(input: unknown) {
  if (typeof input !== 'string') {
    return null;
  }
  if (input.length > MAX_VIDEO_URL_LENGTH) {
    return null;
  }
  const url = input.trim();
  if (!url || url.length > MAX_VIDEO_URL_LENGTH || UNSAFE_VIDEO_URL_CHARS_REGEX.test(url) || url.includes('\\')) {
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

function extractBilibiliBvid(parsedUrl: URL) {
  const hostname = parsedUrl.hostname.replace(/^www\./, '');
  if (hostname === 'bilibili.com') {
    return parsedUrl.pathname.match(/^\/video\/(BV[a-zA-Z0-9]+)/)?.[1] ?? null;
  }
  if (hostname === 'player.bilibili.com') {
    return parsedUrl.searchParams.get('bvid')?.match(/^BV[a-zA-Z0-9]+$/)?.[0] ?? null;
  }
  return null;
}

function parsePositiveNumber(value: unknown) {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  }
  if (typeof value !== 'string' || value.length > MAX_VIDEO_NUMERIC_PARAM_LENGTH) {
    return null;
  }
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    return null;
  }
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function isPublicHttpVideoUrl(url: string) {
  try {
    const parsed = new URL(url);
    return (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:')
      && !parsed.username
      && !parsed.password
      && !isLocalNetworkHttpUrl(url)
    );
  } catch {
    return false;
  }
}

function extractYouTubeVideoId(rawUrl: string) {
  try {
    const parsedUrl = new URL(rawUrl);
    if (!isPublicHttpVideoUrl(parsedUrl.toString())) return null;
    const hostname = parsedUrl.hostname.toLowerCase().replace(/^www\./, '');
    if (hostname === 'youtu.be') {
      return parsedUrl.pathname.split('/').filter(Boolean)[0] ?? null;
    }
    if (
      hostname === 'youtube.com'
      || hostname === 'youtube-nocookie.com'
      || hostname === 'm.youtube.com'
      || hostname === 'music.youtube.com'
    ) {
      const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
      if (pathParts[0] === 'watch') {
        return parsedUrl.searchParams.get('v');
      }
      if (
        pathParts[0] === 'embed'
        || pathParts[0] === 'shorts'
        || pathParts[0] === 'live'
        || pathParts[0] === 'v'
      ) {
        return pathParts[1] ?? null;
      }
    }
  } catch {
    return null;
  }
  return null;
}

export function parseVideoUrl(input: unknown): ParsedVideoUrl | null {
  const url = normalizeVideoUrlInput(input);
  if (!url) return null;

  const youtubeVideoId = extractYouTubeVideoId(url);
  if (youtubeVideoId?.match(/^[a-zA-Z0-9_-]{11}$/)) {
    return {
      type: 'youtube',
      embedUrl: `https://www.youtube.com/embed/${youtubeVideoId}?autoplay=0&playsinline=1&rel=0`,
    };
  }

  try {
    const parsedUrl = new URL(url);
    const bilibiliBvid = isPublicHttpVideoUrl(parsedUrl.toString())
      ? extractBilibiliBvid(parsedUrl)
      : null;
    if (bilibiliBvid) {
      const cid = parsePositiveNumber(parsedUrl.searchParams.get('cid'));
      const aid = parsePositiveNumber(parsedUrl.searchParams.get('aid'));
      const page = parsePositiveNumber(parsedUrl.searchParams.get('p') ?? parsedUrl.searchParams.get('page'));
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

      return {
        type: 'bilibili',
        embedUrl: buildBilibiliEmbedUrl({ bvid: bilibiliBvid, page: page ?? undefined }),
      };
    }
  } catch {
  }

  if (url.match(/\.(mp4|webm|ogg)(\?.*)?$/i) && isPublicHttpVideoUrl(url)) {
    return {
      type: 'direct',
      embedUrl: url,
    };
  }

  return null;
}

export function isSupportedVideoUrl(url: unknown) {
  return parseVideoUrl(url) !== null;
}

export function sanitizeVideoUrlInput(
  input: unknown,
  options: { allowEmpty?: boolean } = {}
) {
  if (typeof input !== 'string') return null;
  if (input.length > MAX_VIDEO_URL_LENGTH) return null;
  if (options.allowEmpty && input.trim() === '') return '';

  const url = normalizeVideoUrlInput(input);
  if (!url || !parseVideoUrl(url)) return null;
  return url;
}
