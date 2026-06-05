import { DEFAULT_EXCLUDED_SITES, isHostMatched } from '../sourceQuality/searchQualityPolicy.mjs';
import { WebSearchError } from '../types.mjs';

const MAX_SEARCH_REDIRECT_TARGET_CHARS = 4096;

function hostnameOf(rawUrl) {
  try {
    return new URL(rawUrl).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

function isBlockedHost(hostname) {
  return DEFAULT_EXCLUDED_SITES.some((blockedHost) => isHostMatched(hostname, blockedHost));
}

function transformGithubBlobUrl(parsedUrl) {
  if (parsedUrl.hostname.replace(/^www\./, '') !== 'github.com') {
    return '';
  }

  const parts = parsedUrl.pathname.split('/').filter(Boolean);
  if (parts.length < 5 || parts[2] !== 'blob') {
    return '';
  }

  const [owner, repo, , ref, ...filePath] = parts;
  if (!owner || !repo || !ref || filePath.length === 0) {
    return '';
  }

  const rawUrl = new URL(`https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${filePath.join('/')}`);
  rawUrl.search = parsedUrl.search;
  return rawUrl.toString();
}

function unwrapSearchRedirect(parsedUrl) {
  const hostname = parsedUrl.hostname.replace(/^www\./, '');
  if (hostname.endsWith('bing.com') && parsedUrl.searchParams.has('u')) {
    const encodedTarget = parsedUrl.searchParams.get('u') || '';
    if (encodedTarget.length > MAX_SEARCH_REDIRECT_TARGET_CHARS) {
      return '';
    }
    const target = encodedTarget.startsWith('a1') ? encodedTarget.slice(2) : encodedTarget;
    try {
      return Buffer.from(target, 'base64url').toString('utf8');
    } catch {
      return '';
    }
  }
  if (hostname === 'google.com' && parsedUrl.pathname === '/url') {
    const target = parsedUrl.searchParams.get('q') || '';
    return target.length <= MAX_SEARCH_REDIRECT_TARGET_CHARS ? target : '';
  }
  if (hostname === 'duckduckgo.com' && parsedUrl.pathname.startsWith('/l/')) {
    const target = parsedUrl.searchParams.get('uddg') || '';
    return target.length <= MAX_SEARCH_REDIRECT_TARGET_CHARS ? target : '';
  }
  return '';
}

export function prepareCrawlerUrl(rawUrl) {
  let parsedUrl;
  try {
    parsedUrl = new URL(String(rawUrl));
  } catch {
    return String(rawUrl);
  }

  const redirectedUrl = unwrapSearchRedirect(parsedUrl);
  if (redirectedUrl) {
    return redirectedUrl;
  }

  const githubRawUrl = transformGithubBlobUrl(parsedUrl);
  if (githubRawUrl) {
    return githubRawUrl;
  }

  return parsedUrl.toString();
}

export function assertAllowedCrawlerUrl(rawUrl) {
  const hostname = hostnameOf(rawUrl);
  let parsedUrl;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    return;
  }
  const pathname = parsedUrl.pathname.toLowerCase();

  if (hostname === 'player.bilibili.com') {
    throw new WebSearchError('blocked_source', 'This source is not allowed for web search.');
  }
  if ((hostname === 'bilibili.com' || hostname.endsWith('.bilibili.com')) && pathname.startsWith('/video/')) {
    throw new WebSearchError('blocked_source', 'This source is not allowed for web search.');
  }
  if (isBlockedHost(hostname)) {
    throw new WebSearchError('blocked_source', 'This source is not allowed for web search.');
  }
}
