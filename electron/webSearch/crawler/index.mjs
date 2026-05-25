import http from 'node:http';
import https from 'node:https';
import zlib from 'node:zlib';
import { resolvePublicUrl } from './ssrfGuard.mjs';
import { DEFAULT_CONTENT_LIMIT, WebSearchError, normalizeLimit } from '../types.mjs';
import { extractJsonContent, extractReadableContent } from './contentExtraction.mjs';
import { assertAllowedCrawlerUrl, prepareCrawlerUrl } from './urlPolicy.mjs';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const MIN_CONTENT_LENGTH = 160;
const MAX_RAW_TEXT_BYTES = 1_000_000;
const CLOUDFLARE_MARKERS = ['cf-chl', 'cloudflare ray id', 'checking your browser'];

function detectSiteName(finalUrl) {
  try {
    return new URL(finalUrl).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function truncateContent(content, limit) {
  return content.length > limit ? `${content.slice(0, limit)}\n\n[Content truncated]` : content;
}

function extractPlainTextContent(content, finalUrl) {
  return {
    title: finalUrl,
    summary: '',
    content,
  };
}

function headersToRecord(headers) {
  const record = {};
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === 'string') {
      record[key] = value;
    } else if (Array.isArray(value)) {
      record[key] = value.join(', ');
    }
  }
  return record;
}

function decodeResponseBody(buffer, contentEncoding) {
  const encoding = String(contentEncoding ?? '').toLowerCase();
  try {
    if (encoding.includes('br')) return zlib.brotliDecompressSync(buffer);
    if (encoding.includes('gzip')) return zlib.gunzipSync(buffer);
    if (encoding.includes('deflate')) return zlib.inflateSync(buffer);
  } catch {
    return buffer;
  }
  return buffer;
}

function buildHostHeader(parsedUrl) {
  const defaultPort = parsedUrl.protocol === 'https:' ? '443' : '80';
  return parsedUrl.port && parsedUrl.port !== defaultPort
    ? `${parsedUrl.hostname}:${parsedUrl.port}`
    : parsedUrl.hostname;
}

function fetchAddress(resolvedUrl, addressEntry, signal) {
  const parsedUrl = resolvedUrl.parsed;
  const address = addressEntry.address;
  const family = addressEntry.family;

  return new Promise((resolve, reject) => {
    let settled = false;
    const rejectRequest = (error) => {
      if (settled) return;
      settled = true;
      reject(error);
      request.destroy(error);
    };
    const transport = parsedUrl.protocol === 'https:' ? https : http;
    const request = transport.request({
      hostname: address,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: `${parsedUrl.pathname}${parsedUrl.search}`,
      method: 'GET',
      servername: parsedUrl.hostname,
      lookup: (_hostname, _options, callback) => callback(null, address, family),
      headers: {
        Accept: 'text/html,application/json,text/plain;q=0.9,*/*;q=0.8',
        Host: buildHostHeader(parsedUrl),
        'User-Agent': USER_AGENT,
      },
    }, (response) => {
      const chunks = [];
      let totalBytes = 0;
      const resolveResponse = () => {
        if (settled) return;
        settled = true;
        resolve(new Response(Buffer.concat(chunks), {
          status: response.statusCode || 0,
          headers: headersToRecord(response.headers),
        }));
      };

      response.on('data', (chunk) => {
        const buffer = Buffer.from(chunk);
        chunks.push(buffer);
        totalBytes += buffer.length;
        if (totalBytes >= MAX_RAW_TEXT_BYTES) {
          resolveResponse();
          request.destroy();
        }
      });
      response.on('end', resolveResponse);
    });

    const abort = () => {
      rejectRequest(new WebSearchError('timeout', 'The page request timed out.'));
    };

    request.on('error', (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    });
    request.setTimeout(5000, () => {
      rejectRequest(new WebSearchError('timeout', 'The page request timed out.'));
    });
    signal?.addEventListener('abort', abort, { once: true });
    request.on('close', () => signal?.removeEventListener('abort', abort));
    request.end();
  });
}

async function fetchWithVerifiedAddress(resolvedUrl, signal) {
  const addresses = [...resolvedUrl.addresses]
    .sort((left, right) => (left.family === 4 ? 0 : 1) - (right.family === 4 ? 0 : 1))
    .slice(0, 4);
  if (addresses.length === 0) {
    throw new WebSearchError('blocked_url', 'This URL resolves to a blocked address.');
  }

  let lastError;
  for (const address of addresses) {
    try {
      return await fetchAddress(resolvedUrl, address, signal);
    } catch (error) {
      lastError = error;
      if (signal?.aborted) {
        throw error;
      }
    }
  }

  throw lastError;
}

async function fetchWithTimeout(fetchImpl, resolvedUrl, timeoutMs, signal) {
  if (signal?.aborted) {
    throw new DOMException('The web search request was cancelled.', 'AbortError');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const combinedSignal = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;

  try {
    if (!fetchImpl) {
      return await fetchWithVerifiedAddress(resolvedUrl, combinedSignal);
    }

    return await fetchImpl(resolvedUrl.url, {
      headers: {
        Accept: 'text/html,application/json,text/plain;q=0.9,*/*;q=0.8',
        'User-Agent': USER_AGENT,
      },
      redirect: 'manual',
      cache: 'no-store',
      signal: combinedSignal,
    });
  } catch (error) {
    if (signal?.aborted) {
      throw new DOMException('The web search request was cancelled.', 'AbortError');
    }
    if (controller.signal.aborted) {
      throw new WebSearchError('timeout', 'The page request timed out.', error);
    }
    throw new WebSearchError('network_error', 'The page could not be reached.', error);
  } finally {
    clearTimeout(timeout);
  }
}

export class Crawler {
  constructor({ fetchImpl, timeoutMs = 12000 } = {}) {
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
  }

  async readUrl(rawUrl, options = {}) {
    const contentLimit = normalizeLimit(options.contentLimit, DEFAULT_CONTENT_LIMIT, 40000);
    const preparedUrl = prepareCrawlerUrl(rawUrl);
    assertAllowedCrawlerUrl(preparedUrl);
    let currentResolution = await resolvePublicUrl(preparedUrl);
    let currentUrl = currentResolution.url;

    for (let redirectCount = 0; redirectCount <= 3; redirectCount += 1) {
      const response = await fetchWithTimeout(this.fetchImpl, currentResolution, this.timeoutMs, options.signal);
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        if (!location) throw new WebSearchError('http_error', `HTTP ${response.status}`);
        const nextUrl = new URL(location, currentUrl).toString();
        assertAllowedCrawlerUrl(nextUrl);
        currentResolution = await resolvePublicUrl(nextUrl);
        currentUrl = currentResolution.url;
        continue;
      }

      if (!response.ok) {
        throw new WebSearchError('http_error', `HTTP ${response.status}`);
      }

      const contentType = response.headers.get('content-type') || '';
      const responseBuffer = Buffer.from(await response.arrayBuffer());
      const rawText = decodeResponseBody(responseBuffer, response.headers.get('content-encoding'))
        .toString('utf8')
        .slice(0, MAX_RAW_TEXT_BYTES);
      const lowerText = rawText.slice(0, 8000).toLowerCase();
      if (CLOUDFLARE_MARKERS.some((marker) => lowerText.includes(marker))) {
        throw new WebSearchError('blocked_page', 'The page blocked automated reading.');
      }

      let extracted;
      if (contentType.includes('application/json')) {
        try {
          extracted = extractJsonContent(JSON.parse(rawText), currentUrl);
        } catch (error) {
          throw new WebSearchError('invalid_json', 'The page returned invalid JSON.', error);
        }
      } else if (contentType.includes('text/plain')) {
        extracted = extractPlainTextContent(rawText, currentUrl);
      } else {
        extracted = extractReadableContent(rawText, currentUrl);
      }

      if (extracted.content.trim().length < MIN_CONTENT_LENGTH) {
        throw new WebSearchError('content_too_short', 'The readable page content is too short.');
      }

      return {
        title: extracted.title,
        summary: extracted.summary,
        siteName: detectSiteName(currentUrl),
        finalUrl: currentUrl,
        content: truncateContent(extracted.content, contentLimit),
        charCount: extracted.content.length,
      };
    }

    throw new WebSearchError('redirect_error', 'Too many redirects.');
  }
}
