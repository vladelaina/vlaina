const CONTROL_OR_BIDI_PATTERN = /[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069\uFFFD]/;
const SCHEME_PATTERN = /^([A-Za-z][A-Za-z0-9+.-]*):/;
const WINDOWS_ABSOLUTE_PATH_PATTERN = /^[A-Za-z]:[\\/]/;
const UNIX_ABSOLUTE_PATH_PATTERN = /^\//;
const SAFE_LINK_SCHEMES = new Set(['http:', 'https:', 'mailto:']);
const SAFE_MEDIA_SCHEMES = new Set(['http:', 'https:', 'blob:']);
const FALLBACK_URL_BASE = 'https://vlaina.local/';

function hasUnsafeUrlCharacters(value: string): boolean {
  return CONTROL_OR_BIDI_PATTERN.test(value);
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
  if (normalized.startsWith('::ffff:')) {
    const parts = normalized.slice('::ffff:'.length).split(':');
    if (parts.length === 2) {
      const high = Number.parseInt(parts[0], 16);
      const low = Number.parseInt(parts[1], 16);
      if (Number.isFinite(high) && Number.isFinite(low)) {
        const mapped = [
          (high >> 8) & 255,
          high & 255,
          (low >> 8) & 255,
          low & 255,
        ].join('.');
        return isPrivateIPv4(mapped);
      }
    }
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
  if (hasUnsafeUrlCharacters(trimmed)) return false;
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

export function sanitizeNoteLinkHref(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (
    !trimmed
    || trimmed.startsWith('//')
    || hasUnsafeUrlCharacters(trimmed)
    || WINDOWS_ABSOLUTE_PATH_PATTERN.test(trimmed)
  ) return null;

  const scheme = SCHEME_PATTERN.exec(trimmed)?.[1]?.toLowerCase();
  if (!scheme) return trimmed;
  const normalizedScheme = `${scheme}:`;
  return SAFE_LINK_SCHEMES.has(normalizedScheme) ? trimmed : null;
}

export function sanitizeNoteMediaSrc(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (
    !trimmed
    || hasUnsafeUrlCharacters(trimmed)
    || WINDOWS_ABSOLUTE_PATH_PATTERN.test(trimmed)
    || (UNIX_ABSOLUTE_PATH_PATTERN.test(trimmed) && !trimmed.startsWith('//'))
  ) {
    return null;
  }

  if (trimmed.startsWith('//')) {
    return isLocalNetworkHttpUrl(`https:${trimmed}`) ? null : trimmed;
  }

  const scheme = SCHEME_PATTERN.exec(trimmed)?.[1]?.toLowerCase();
  if (!scheme) return trimmed;
  const normalizedScheme = `${scheme}:`;
  if (!SAFE_MEDIA_SCHEMES.has(normalizedScheme)) return null;
  if ((normalizedScheme === 'http:' || normalizedScheme === 'https:') && isLocalNetworkHttpUrl(trimmed)) return null;
  return trimmed;
}
