import { logNotesDebug } from '@/stores/notes/debugLog';

const VIDEO_DEBUG_URL_KEYS = new Set([
  'url',
  'src',
  'embedUrl',
  'iframeSrc',
  'previousSrc',
  'nextSrc',
  'directNodeSrc',
  'resolvedUrl',
]);
const VIDEO_DEBUG_QUERY_ALLOWLIST = new Set([
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

let videoDebugListenersRegistered = false;

function redactVideoUrlForDebug(value: string) {
  const trimmed = value.trim();
  let redacted = trimmed;
  try {
    const url = new URL(trimmed);
    const redactedParams = new URLSearchParams();
    url.searchParams.forEach((paramValue, key) => {
      redactedParams.set(key, VIDEO_DEBUG_QUERY_ALLOWLIST.has(key) ? paramValue : '[redacted]');
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
    if (typeof value === 'string' && key && VIDEO_DEBUG_URL_KEYS.has(key)) {
      return redactVideoUrlForDebug(value);
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

export function logVideoDebug(event: string, payload: Record<string, unknown>) {
  const debugPayload = sanitizeVideoDebugPayload(payload);
  logNotesDebug(`videoPlugin:${event}`, debugPayload);
  console.info(`[videoPlugin:${event}]`, debugPayload);
}

export function getEventTargetDebug(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return {
      tag: target ? target.constructor.name : null,
      className: '',
      isIframe: false,
      isVideo: false,
      insideMedia: false,
      insideShield: false,
    };
  }

  return {
    tag: target.tagName.toLowerCase(),
    className: target.className,
    isIframe: target.tagName.toLowerCase() === 'iframe',
    isVideo: target.tagName.toLowerCase() === 'video',
    insideMedia: Boolean(target.closest('iframe, video')),
    insideShield: Boolean(target.closest('.video-selection-shield')),
  };
}

export function getDomRectDebug(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  return {
    width: rect.width,
    height: rect.height,
    left: rect.left,
    top: rect.top,
    offsetWidth: element.offsetWidth,
    offsetHeight: element.offsetHeight,
    isConnected: element.isConnected,
  };
}

export function registerVideoDebugListeners() {
  if (videoDebugListenersRegistered || typeof window === 'undefined') {
    return;
  }

  videoDebugListenersRegistered = true;
  window.addEventListener('securitypolicyviolation', (event) => {
    logVideoDebug('security_policy_violation', {
      blockedURI: event.blockedURI,
      violatedDirective: event.violatedDirective,
      effectiveDirective: event.effectiveDirective,
      originalPolicy: event.originalPolicy,
      disposition: event.disposition,
      sourceFile: event.sourceFile,
      lineNumber: event.lineNumber,
      columnNumber: event.columnNumber,
    });
  });
}
