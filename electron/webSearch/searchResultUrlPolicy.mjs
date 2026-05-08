import { cleanText } from './crawler/contentExtraction.mjs';
import { BLOCKED_RESULT_HOSTS, getQuerySensitiveBlockedSites, isHostMatched } from './sourceQuality/searchQualityPolicy.mjs';
import { isBlockedIp } from './crawler/ssrfGuard.mjs';

export function normalizeResultUrl(rawUrl) {
  if (!rawUrl) return '';
  try {
    const decodedUrl = cleanText(rawUrl);
    const parsed = new URL(
      decodedUrl,
      decodedUrl.startsWith('/url?')
        ? 'https://www.google.com'
        : decodedUrl.startsWith('/l/')
          ? 'https://duckduckgo.com'
          : undefined,
    );
    if (parsed.hostname.endsWith('bing.com') && parsed.searchParams.has('u')) {
      const encodedTarget = parsed.searchParams.get('u') || '';
      const target = encodedTarget.startsWith('a1') ? encodedTarget.slice(2) : encodedTarget;
      return Buffer.from(target, 'base64url').toString('utf8');
    }
    if (parsed.hostname.endsWith('google.com') && parsed.pathname === '/url' && parsed.searchParams.has('q')) {
      return parsed.searchParams.get('q') || '';
    }
    if (parsed.hostname.endsWith('duckduckgo.com') && parsed.pathname.startsWith('/l/') && parsed.searchParams.has('uddg')) {
      return parsed.searchParams.get('uddg') || '';
    }
    return parsed.toString();
  } catch {
    return '';
  }
}

export function isBlockedResultUrl(url, options = {}) {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.replace(/^www\./, '').toLowerCase();
    const pathname = parsed.pathname.toLowerCase();
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return true;
    if (!hostname || hostname === 'localhost' || hostname.endsWith('.local') || hostname.endsWith('.internal')) return true;
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
