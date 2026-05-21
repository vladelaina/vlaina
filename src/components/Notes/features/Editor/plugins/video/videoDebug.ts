const VIDEO_URL_KEYS = new Set([
  'url',
  'src',
  'embedUrl',
  'iframeSrc',
  'previousSrc',
  'nextSrc',
  'directNodeSrc',
  'resolvedUrl',
]);
const VIDEO_QUERY_ALLOWLIST = new Set([
  'aid',
  'autoplay',
  'bvid',
  'cid',
  'danmaku',
  'isOutside',
  'p',
  'page',
  'playsinline',
  'rel',
  'v',
]);

function redactVideoUrl(value: string) {
  const trimmed = value.trim();
  let redacted = trimmed;
  try {
    const url = new URL(trimmed);
    const redactedParams = new URLSearchParams();
    url.searchParams.forEach((paramValue, key) => {
      redactedParams.set(key, VIDEO_QUERY_ALLOWLIST.has(key) ? paramValue : '[redacted]');
    });
    url.search = redactedParams.toString();
    redacted = url.toString();
  } catch {
    redacted = trimmed;
  }
  redacted = redacted.replace(/[\r\n]+/g, ' ');

  const maxPreviewLength = 220;
  return {
    value: redacted.length > maxPreviewLength
      ? `${redacted.slice(0, maxPreviewLength)}...`
      : redacted,
    length: value.length,
    hasNewline: /[\r\n]/.test(value),
    truncated: redacted.length > maxPreviewLength,
  };
}

export function sanitizeVideoDebugPayload(payload: unknown): unknown {
  const sanitize = (value: unknown, key?: string): unknown => {
    if (typeof value === 'string' && key && VIDEO_URL_KEYS.has(key)) {
      return redactVideoUrl(value);
    }
    if (Array.isArray(value)) {
      return value.map((item) => sanitize(item));
    }
    if (!value || typeof value !== 'object') {
      return value;
    }

    const output: Record<string, unknown> = {};
    for (const [entryKey, entryValue] of Object.entries(value)) {
      output[entryKey] = sanitize(entryValue, entryKey);
    }
    return output;
  };

  return sanitize(payload);
}
