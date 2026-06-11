export const MAX_ELECTRON_EXTERNAL_URL_CHARS = 4096;
const CONTROL_OR_BIDI_PATTERN = /[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069\uFFFD]/;
const HTTP_AUTHORITY_URL_PATTERN = /^https?:\/\//i;
const PROXY_AUTHORITY_URL_PATTERN = /^(?:https?|socks[45]):\/\//i;

function isUrlTooLong(value) {
  return value.length > MAX_ELECTRON_EXTERNAL_URL_CHARS;
}

function hasUnsafeUrlCharacters(value) {
  return CONTROL_OR_BIDI_PATTERN.test(value) || value.includes('\\');
}

function parseIPv4(hostname) {
  const parts = hostname.split('.');
  if (parts.length !== 4) return null;
  const octets = parts.map((part) => Number(part));
  if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return null;
  return octets;
}

function isPrivateIPv4(hostname) {
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

function parseEmbeddedIPv4Hextets(parts) {
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

function hasPrivateEmbeddedIPv4(normalized, prefix) {
  if (!normalized.startsWith(prefix)) return false;
  const embedded = parseEmbeddedIPv4Hextets(normalized.slice(prefix.length).split(':'));
  return embedded ? isPrivateIPv4(embedded) : false;
}

function isLocalNetworkHostname(hostname) {
  const normalized = hostname.replace(/\.+$/g, '');
  return (
    normalized === 'localhost'
    || normalized.endsWith('.localhost')
    || normalized.endsWith('.local')
    || normalized.endsWith('.home.arpa')
    || (!normalized.includes('.') && !normalized.includes(':'))
  );
}

function isPrivateIPv6(hostname) {
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

function isLocalNetworkHttpUrl(parsed) {
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
  const hostname = parsed.hostname.toLowerCase();
  return isLocalNetworkHostname(hostname) || isPrivateIPv4(hostname) || isPrivateIPv6(hostname);
}

export function redactUrlCredentials(rawUrl) {
  const value = rawUrl instanceof URL ? rawUrl.toString() : String(rawUrl);
  if (isUrlTooLong(value)) {
    return '';
  }

  try {
    const parsed = new URL(value);
    if (parsed.username || parsed.password) {
      parsed.username = parsed.username ? 'redacted' : '';
      parsed.password = parsed.password ? 'redacted' : '';
    }
    return parsed.toString();
  } catch {
    return '';
  }
}

export function summarizeUrlForLog(rawUrl) {
  const value = String(rawUrl);
  if (isUrlTooLong(value)) {
    return '';
  }

  try {
    const parsed = new URL(value);
    parsed.search = '';
    parsed.hash = '';
    parsed.username = '';
    parsed.password = '';
    return parsed.toString();
  } catch {
    return '';
  }
}

export function normalizeProxyConfig(rawProxy, source) {
  const rawValue = String(rawProxy ?? '');
  if (isUrlTooLong(rawValue)) return null;

  const proxy = rawValue.trim();
  if (!proxy) return null;

  try {
    const parsed = new URL(proxy);
    if (!PROXY_AUTHORITY_URL_PATTERN.test(proxy)) {
      return null;
    }
    if (!['http:', 'https:', 'socks4:', 'socks5:'].includes(parsed.protocol)) {
      return null;
    }
    const host = parsed.hostname.includes(':') ? `[${parsed.hostname}]` : parsed.hostname;
    const hostPort = parsed.port ? `${host}:${parsed.port}` : host;
    const proxyRules = parsed.protocol === 'http:' || parsed.protocol === 'https:'
      ? `http=${hostPort};https=${hostPort}`
      : `${parsed.protocol}//${hostPort}`;
    return {
      proxyServer: redactUrlCredentials(parsed),
      proxyRules,
      source,
    };
  } catch {
    return null;
  }
}

export function normalizeExternalUrl(rawUrl) {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
    throw new Error('A non-empty URL is required.');
  }
  if (isUrlTooLong(rawUrl)) {
    throw new Error('URL is too long.');
  }

  const trimmed = rawUrl.trim();
  if (isUrlTooLong(trimmed)) {
    throw new Error('URL is too long.');
  }
  if (hasUnsafeUrlCharacters(trimmed)) {
    throw new Error('URL contains unsafe characters.');
  }

  const parsed = new URL(trimmed);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:' && parsed.protocol !== 'mailto:') {
    throw new Error(`Unsupported external URL protocol: ${parsed.protocol}`);
  }
  if ((parsed.protocol === 'http:' || parsed.protocol === 'https:') && !HTTP_AUTHORITY_URL_PATTERN.test(trimmed)) {
    throw new Error('HTTP external URLs must include an authority.');
  }
  if (parsed.username || parsed.password) {
    throw new Error('External URLs with credentials are not allowed.');
  }
  if (isLocalNetworkHttpUrl(parsed)) {
    throw new Error('Local-network external URLs are not allowed.');
  }

  return parsed.toString();
}

export function normalizeHttpUrl(rawUrl, label) {
  const normalized = normalizeExternalUrl(rawUrl);
  const parsed = new URL(normalized);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`${label} must be an HTTP or HTTPS URL.`);
  }
  return parsed.toString();
}
