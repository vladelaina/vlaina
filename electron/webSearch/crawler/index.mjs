import { resolvePublicUrl } from './ssrfGuard.mjs';
import { DEFAULT_CONTENT_LIMIT, WebSearchError, normalizeLimit } from '../types.mjs';
import { extractJsonContent, extractReadableContent } from './contentExtraction.mjs';
import { assertAllowedCrawlerUrl, prepareCrawlerUrl } from './urlPolicy.mjs';
import {
  DEFAULT_CRAWLER_TIMEOUT_MS,
  MAX_RAW_TEXT_BYTES,
  decodeResponseBody,
  fetchAddress,
  fetchWithTimeout,
  normalizeCrawlerTimeoutMs,
  readResponseArrayBuffer,
  throwIfAborted,
} from './fetch.mjs';

const MIN_CONTENT_LENGTH = 160;
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

export class Crawler {
  constructor({ fetchImpl, timeoutMs = DEFAULT_CRAWLER_TIMEOUT_MS } = {}) {
    this.fetchImpl = fetchImpl;
    this.timeoutMs = normalizeCrawlerTimeoutMs(timeoutMs);
  }

  async readUrl(rawUrl, options = {}) {
    throwIfAborted(options.signal);
    const contentLimit = normalizeLimit(options.contentLimit, DEFAULT_CONTENT_LIMIT, 40000);
    const preparedUrl = prepareCrawlerUrl(rawUrl);
    assertAllowedCrawlerUrl(preparedUrl);
    throwIfAborted(options.signal);
    let currentResolution = await resolvePublicUrl(preparedUrl);
    throwIfAborted(options.signal);
    let currentUrl = currentResolution.url;

    for (let redirectCount = 0; redirectCount <= 3; redirectCount += 1) {
      throwIfAborted(options.signal);
      const { response, responseBuffer } = await fetchWithTimeout(
        this.fetchImpl,
        currentResolution,
        this.timeoutMs,
        options.signal,
        async (response, requestSignal) => {
          throwIfAborted(requestSignal);
          if ([301, 302, 303, 307, 308].includes(response.status) || !response.ok) {
            return { response, responseBuffer: null };
          }
          return {
            response,
            responseBuffer: Buffer.from(await readResponseArrayBuffer(response, requestSignal)),
          };
        },
      );
      throwIfAborted(options.signal);
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        if (!location) throw new WebSearchError('http_error', `HTTP ${response.status}`);
        const nextUrl = new URL(location, currentUrl).toString();
        assertAllowedCrawlerUrl(nextUrl);
        throwIfAborted(options.signal);
        currentResolution = await resolvePublicUrl(nextUrl);
        throwIfAborted(options.signal);
        currentUrl = currentResolution.url;
        continue;
      }

      if (!response.ok) {
        throw new WebSearchError('http_error', `HTTP ${response.status}`);
      }

      const contentType = response.headers.get('content-type') || '';
      throwIfAborted(options.signal);
      throwIfAborted(options.signal);
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

export const crawlerInternals = {
  fetchAddress,
};
