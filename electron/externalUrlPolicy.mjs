export const MAX_ELECTRON_EXTERNAL_URL_CHARS = 4096;

function isUrlTooLong(value) {
  return value.length > MAX_ELECTRON_EXTERNAL_URL_CHARS;
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

  const parsed = new URL(trimmed);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:' && parsed.protocol !== 'mailto:') {
    throw new Error(`Unsupported external URL protocol: ${parsed.protocol}`);
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
