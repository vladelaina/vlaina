import { DEFAULT_BATCH_CONCURRENCY, DEFAULT_CRAWL_RETRY } from '../types.mjs';

const RETRYABLE_ERROR_CODES = new Set(['network_error', 'timeout']);
const MAX_BATCH_NUMERIC_OPTION_CHARS = 16;

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

function normalizeBatchInteger(value, fallback, min, max) {
  let parsed = Number.NaN;
  if (typeof value === 'number') {
    parsed = value;
  } else if (typeof value === 'string' && value.length <= MAX_BATCH_NUMERIC_OPTION_CHARS) {
    const trimmed = value.trim();
    parsed = /^\d+$/.test(trimmed) ? Number.parseInt(trimmed, 10) : Number.NaN;
  }
  if (!Number.isFinite(parsed) || parsed < min) {
    return fallback;
  }
  return Math.max(min, Math.min(Math.floor(parsed), max));
}

function getReadErrorMessage(error) {
  if (error instanceof Error) {
    return error.message;
  }
  if (error && typeof error === 'object' && typeof error.message === 'string') {
    return error.message;
  }
  switch (typeof error) {
    case 'string':
    case 'number':
    case 'boolean':
    case 'bigint':
    case 'symbol':
      return String(error);
    default:
      return 'Read failed';
  }
}

async function readWithRetry(crawler, url, options, retries) {
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      throwIfAborted(options.signal);
      const page = await crawler.readUrl(url, options);
      throwIfAborted(options.signal);
      return page;
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
  const concurrency = normalizeBatchInteger(options.concurrency, DEFAULT_BATCH_CONCURRENCY, 1, 5);
  const retries = normalizeBatchInteger(options.retries ?? DEFAULT_CRAWL_RETRY, DEFAULT_CRAWL_RETRY, 0, 2);
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
          error: getReadErrorMessage(error),
          code: typeof error?.code === 'string' ? error.code : 'read_failed',
        };
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, inputUrls.length) }, () => worker()));
  throwIfAborted(options.signal);
  return results;
}
