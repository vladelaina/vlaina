import { cleanText } from './crawler/contentExtraction.mjs';
import { BLOCKED_RESULT_HOSTS, getQuerySensitiveBlockedSites, isHostMatched } from './sourceQuality/searchQualityPolicy.mjs';
import { isBlockedIp } from './crawler/ssrfGuard.mjs';

const MAX_RESULT_URL_CHARS = 4096;
const HTTP_AUTHORITY_URL_PATTERN = /^https?:\/\//i;
const UNSAFE_RESULT_URL_CHARS_PATTERN = /[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069\uFFFD]/;

function hasUnsafeResultUrlSyntax(value) {
  return (
    !value ||
    value.length > MAX_RESULT_URL_CHARS ||
    UNSAFE_RESULT_URL_CHARS_PATTERN.test(value) ||
    value.includes('\\')
  );
}

function isSearchEngineHost(hostname, domain) {
  const normalized = hostname.replace(/^www\./, '').toLowerCase();
  return normalized === domain || normalized.endsWith(`.${domain}`);
}

function normalizeHttpResultUrl(value, baseUrl) {
  const decodedUrl = cleanText(value);
  if (hasUnsafeResultUrlSyntax(decodedUrl)) return '';
  if (!baseUrl && !HTTP_AUTHORITY_URL_PATTERN.test(decodedUrl)) return '';

  try {
    const parsed = new URL(decodedUrl, baseUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    if (parsed.username || parsed.password) return '';
    return parsed.toString();
  } catch {
    return '';
  }
}

export function normalizeResultUrl(rawUrl) {
  if (typeof rawUrl !== 'string' || !rawUrl) return '';
  try {
    const decodedUrl = cleanText(rawUrl);
    if (hasUnsafeResultUrlSyntax(decodedUrl)) return '';
    const baseUrl = decodedUrl.startsWith('/url?')
      ? 'https://www.google.com'
      : decodedUrl.startsWith('/l/')
        ? 'https://duckduckgo.com'
        : undefined;
    if (!baseUrl && !HTTP_AUTHORITY_URL_PATTERN.test(decodedUrl)) return '';

    const parsed = new URL(
      decodedUrl,
      baseUrl,
    );
    if (isSearchEngineHost(parsed.hostname, 'bing.com') && parsed.searchParams.has('u')) {
      const encodedTarget = parsed.searchParams.get('u') || '';
      const target = encodedTarget.startsWith('a1') ? encodedTarget.slice(2) : encodedTarget;
      return normalizeHttpResultUrl(Buffer.from(target, 'base64url').toString('utf8'));
    }
    if (isSearchEngineHost(parsed.hostname, 'google.com') && parsed.pathname === '/url' && parsed.searchParams.has('q')) {
      return normalizeHttpResultUrl(parsed.searchParams.get('q') || '');
    }
    if (isSearchEngineHost(parsed.hostname, 'duckduckgo.com') && parsed.pathname.startsWith('/l/') && parsed.searchParams.has('uddg')) {
      return normalizeHttpResultUrl(parsed.searchParams.get('uddg') || '');
    }
    return normalizeHttpResultUrl(parsed.toString());
  } catch {
    return '';
  }
}

export function isBlockedResultUrl(url, options = {}) {
  if (typeof url !== 'string') return true;
  try {
    const trimmed = cleanText(url);
    if (hasUnsafeResultUrlSyntax(trimmed) || !HTTP_AUTHORITY_URL_PATTERN.test(trimmed)) return true;
    const parsed = new URL(trimmed);
    const hostname = parsed.hostname.replace(/^www\./, '').replace(/\.+$/g, '').toLowerCase();
    const pathname = parsed.pathname.toLowerCase();
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return true;
    if (parsed.username || parsed.password) return true;
    if (
      !hostname ||
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.localdomain') ||
      hostname.endsWith('.internal') ||
      hostname.endsWith('.home.arpa') ||
      (!hostname.includes('.') && !hostname.includes(':'))
    ) return true;
    if (isBlockedIp(hostname)) return true;
    if (hostname === 'player.bilibili.com') return true;
    if ((hostname === 'bilibili.com' || hostname.endsWith('.bilibili.com')) && pathname.startsWith('/video/')) return true;
    if (hostname === 'gizmodo.com' && pathname.startsWith('/download/')) return true;
    const blockedHosts = [
      ...BLOCKED_RESULT_HOSTS,
      ...getQuerySensitiveBlockedSites(options.query),
    ];
    return blockedHosts.some((blockedHost) => isHostMatched(hostname, blockedHost));
  } catch {
    return true;
  }
}
