import { normalizeSafeRasterDataImageSrc } from '@/lib/markdown/dataImagePolicy';
import { hasInternalNoteAssetUrlPathSegment } from '@/lib/assets/core/internalAssetPaths';

const CONTROL_OR_BIDI_PATTERN = /[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069\uFFFD]/;
const SCHEME_PATTERN = /^([A-Za-z][A-Za-z0-9+.-]*):/;
const WINDOWS_ABSOLUTE_PATH_PATTERN = /^[A-Za-z]:[\\/]/;
const UNIX_ABSOLUTE_PATH_PATTERN = /^\//;
const SAFE_LINK_SCHEMES = new Set(['http:', 'https:', 'mailto:']);
const SAFE_MEDIA_SCHEMES = new Set(['http:', 'https:', 'blob:']);
const FALLBACK_URL_BASE = 'https://vlaina.local/';
const MAX_NOTE_LINK_HREF_CHARS = 16 * 1024;
const MAX_NOTE_REMOTE_MEDIA_URL_CHARS = 16 * 1024;
const MAX_NOTE_INTERNAL_IMAGE_SRC_CHARS = 16 * 1024;

function hasUnsafeUrlCharacters(value: string): boolean {
  return CONTROL_OR_BIDI_PATTERN.test(value);
}

function hasUnsafeBackslashUrlSyntax(value: string): boolean {
  return value.startsWith('\\') || (SCHEME_PATTERN.test(value) && value.includes('\\'));
}

function getUrlBase(): string {
  return typeof window !== 'undefined' ? window.location.href : FALLBACK_URL_BASE;
}

function parseIPv4(hostname: string): [number, number, number, number] | null {
  const parts = hostname.split('.');
  if (parts.length !== 4) return null;
  const octets = parts.map((part) => Number(part));
  if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return null;
  return octets as [number, number, number, number];
}

function isPrivateIPv4(hostname: string): boolean {
  const octets = parseIPv4(hostname);
  if (!octets) return false;
  const [a, b] = octets;
  return (
    a === 0
    || a === 10
    || a === 127
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || (a === 198 && (b === 18 || b === 19))
    || a >= 224
  );
}

function parseEmbeddedIPv4Hextets(parts: string[]): string | null {
  if (parts.length !== 2) return null;
  if (parts.some((part) => !/^[\da-f]{1,4}$/i.test(part))) return null;

  const high = Number.parseInt(parts[0], 16);
  const low = Number.parseInt(parts[1], 16);
  if (!Number.isFinite(high) || !Number.isFinite(low)) return null;

  return [
    (high >> 8) & 255,
    high & 255,
    (low >> 8) & 255,
    low & 255,
  ].join('.');
}

function hasPrivateEmbeddedIPv4(normalized: string, prefix: string): boolean {
  if (!normalized.startsWith(prefix)) return false;
  const embedded = parseEmbeddedIPv4Hextets(normalized.slice(prefix.length).split(':'));
  return embedded ? isPrivateIPv4(embedded) : false;
}

function isLocalNetworkHostname(hostname: string): boolean {
  const normalized = hostname.replace(/\.+$/g, '');
  return (
    normalized === 'localhost'
    || normalized.endsWith('.localhost')
    || normalized.endsWith('.local')
    || normalized.endsWith('.home.arpa')
    || (!normalized.includes('.') && !normalized.includes(':'))
  );
}

function isPrivateIPv6(hostname: string): boolean {
  const normalized = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (
    hasPrivateEmbeddedIPv4(normalized, '::ffff:')
    || hasPrivateEmbeddedIPv4(normalized, '::ffff:0:')
    || hasPrivateEmbeddedIPv4(normalized, '::')
  ) {
    return true;
  }
  return (
    normalized === '::'
    || normalized === '::1'
    || normalized.startsWith('fe80:')
    || normalized.startsWith('fc')
    || normalized.startsWith('fd')
    || normalized.startsWith('ff')
  );
}

export function isLocalNetworkHttpUrl(value: string): boolean {
  try {
    const url = new URL(value, getUrlBase());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    const hostname = url.hostname.toLowerCase();
    return isLocalNetworkHostname(hostname) || isPrivateIPv4(hostname) || isPrivateIPv6(hostname);
  } catch {
    return false;
  }
}

export function isPublicRemoteMediaUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.length > MAX_NOTE_REMOTE_MEDIA_URL_CHARS) return false;
  if (hasUnsafeUrlCharacters(trimmed)) return false;
  if (hasUnsafeBackslashUrlSyntax(trimmed)) return false;
  if (!trimmed.startsWith('//') && !/^https?:/i.test(trimmed)) return false;

  const normalized = trimmed.startsWith('//') ? `https:${trimmed}` : trimmed;
  try {
    const url = new URL(normalized, getUrlBase());
    return (
      (url.protocol === 'http:' || url.protocol === 'https:')
      && !isLocalNetworkHttpUrl(normalized)
    );
  } catch {
    return false;
  }
}

export function normalizePublicRemoteMediaUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  if (!isPublicRemoteMediaUrl(value)) return null;

  const trimmed = value.trim();
  return trimmed.startsWith('//') ? `https:${trimmed}` : trimmed;
}

export function sanitizeNoteLinkHref(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (
    !trimmed
    || trimmed.length > MAX_NOTE_LINK_HREF_CHARS
    || trimmed.startsWith('//')
    || hasUnsafeUrlCharacters(trimmed)
    || hasUnsafeBackslashUrlSyntax(trimmed)
    || WINDOWS_ABSOLUTE_PATH_PATTERN.test(trimmed)
  ) return null;

  const scheme = SCHEME_PATTERN.exec(trimmed)?.[1]?.toLowerCase();
  if (!scheme && hasInternalNoteAssetUrlPathSegment(trimmed)) return null;
  if (!scheme) return trimmed;
  const normalizedScheme = `${scheme}:`;
  return SAFE_LINK_SCHEMES.has(normalizedScheme) ? trimmed : null;
}

export function getNoteInternalImageAssetPath(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length > MAX_NOTE_INTERNAL_IMAGE_SRC_CHARS) return null;
  const scheme = SCHEME_PATTERN.exec(trimmed)?.[1]?.toLowerCase();
  if (scheme !== 'img') return null;

  const assetPath = trimmed.slice(trimmed.indexOf(':') + 1);
  if (
    !assetPath
    || hasUnsafeUrlCharacters(assetPath)
    || hasInternalNoteAssetUrlPathSegment(assetPath)
    || assetPath.startsWith('//')
    || assetPath.startsWith('\\')
    || WINDOWS_ABSOLUTE_PATH_PATTERN.test(assetPath)
    || UNIX_ABSOLUTE_PATH_PATTERN.test(assetPath)
  ) {
    return null;
  }

  return assetPath;
}

export function sanitizeNoteMediaSrc(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (
    !trimmed
    || hasUnsafeUrlCharacters(trimmed)
    || hasUnsafeBackslashUrlSyntax(trimmed)
    || WINDOWS_ABSOLUTE_PATH_PATTERN.test(trimmed)
    || (UNIX_ABSOLUTE_PATH_PATTERN.test(trimmed) && !trimmed.startsWith('//'))
  ) {
    return null;
  }

  if (trimmed.startsWith('//')) {
    if (trimmed.length > MAX_NOTE_REMOTE_MEDIA_URL_CHARS) return null;
    return isLocalNetworkHttpUrl(`https:${trimmed}`) ? null : `https:${trimmed}`;
  }

  const scheme = SCHEME_PATTERN.exec(trimmed)?.[1]?.toLowerCase();
  if (!scheme) {
    return trimmed.length <= MAX_NOTE_INTERNAL_IMAGE_SRC_CHARS
      && !hasInternalNoteAssetUrlPathSegment(trimmed)
      ? trimmed
      : null;
  }
  const normalizedScheme = `${scheme}:`;
  if (normalizedScheme === 'img:') {
    const assetPath = getNoteInternalImageAssetPath(trimmed);
    return assetPath ? trimmed : null;
  }
  if (normalizedScheme === 'data:') {
    return normalizeSafeRasterDataImageSrc(trimmed);
  }
  if (
    (normalizedScheme === 'http:' || normalizedScheme === 'https:' || normalizedScheme === 'blob:') &&
    trimmed.length > MAX_NOTE_REMOTE_MEDIA_URL_CHARS
  ) return null;
  if (!SAFE_MEDIA_SCHEMES.has(normalizedScheme)) return null;
  if ((normalizedScheme === 'http:' || normalizedScheme === 'https:') && isLocalNetworkHttpUrl(trimmed)) return null;
  return trimmed;
}
