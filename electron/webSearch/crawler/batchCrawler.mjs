import { DEFAULT_BATCH_CONCURRENCY, DEFAULT_CRAWL_RETRY } from '../types.mjs';

const RETRYABLE_ERROR_CODES = new Set(['network_error', 'timeout']);

function throwIfAborted(signal) {
  if (!signal?.aborted) return;
  throw new DOMException('The web search request was cancelled.', 'AbortError');
}

function isAbortError(error) {
  return error instanceof DOMException && error.name === 'AbortError';
}

function shouldRetryRead(error) {
  return RETRYABLE_ERROR_CODES.has(error?.code);
}

async function readWithRetry(crawler, url, options, retries) {
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      throwIfAborted(options.signal);
      return await crawler.readUrl(url, options);
    } catch (error) {
      if (isAbortError(error)) {
        throw error;
      }
      lastError = error;
      if (attempt >= retries || !shouldRetryRead(error)) {
        break;
      }
    }
  }

  throw lastError;
}

export async function readUrlsBatch(crawler, urls, options = {}) {
  throwIfAborted(options.signal);
  const inputUrls = Array.isArray(urls) ? urls.slice(0, 8) : [];
  const concurrency = Math.max(1, Math.min(Number(options.concurrency) || DEFAULT_BATCH_CONCURRENCY, 5));
  const retries = Math.max(0, Math.min(Number(options.retries ?? DEFAULT_CRAWL_RETRY), 2));
  const results = new Array(inputUrls.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < inputUrls.length) {
      throwIfAborted(options.signal);
      const index = nextIndex;
      nextIndex += 1;
      const url = inputUrls[index];
      try {
        results[index] = {
          url,
          ok: true,
          page: await readWithRetry(crawler, url, options, retries),
        };
      } catch (error) {
        if (isAbortError(error)) {
          throw error;
        }
        results[index] = {
          url,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
          code: typeof error?.code === 'string' ? error.code : 'read_failed',
        };
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, inputUrls.length) }, () => worker()));
  return results;
}
