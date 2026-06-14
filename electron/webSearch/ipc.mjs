import { Crawler } from './crawler/index.mjs';
import { readUrlsBatch } from './crawler/batchCrawler.mjs';
import { SearchService } from './searchService.mjs';
import { LocalSearchProvider } from './providers/localSearchProvider.mjs';
import { MAX_WEB_SEARCH_QUERY_CHARS, WebSearchError } from './types.mjs';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,160}$/;
const MAX_IPC_OPTION_CHARS = 64;
const MAX_IPC_READ_URL_CHARS = 4096;
const MAX_IPC_BATCH_READ_URLS = 8;
const DECIMAL_NUMBER_PATTERN = /^-?(?:\d+(?:\.\d+)?|\.\d+)$/;

function normalizeRequestId(rawRequestId) {
  if (typeof rawRequestId !== 'string' || rawRequestId.length > 160) {
    return null;
  }
  const requestId = rawRequestId.trim();
  return REQUEST_ID_PATTERN.test(requestId) ? requestId : null;
}

function createAbortError() {
  return new DOMException('The web search request was cancelled.', 'AbortError');
}

function throwIfAborted(signal) {
  if (!signal?.aborted) return;
  throw createAbortError();
}

function normalizeSearchOptions(rawOptions) {
  return {
    category: normalizeOptionString(rawOptions?.category),
    timeRange: normalizeOptionString(rawOptions?.timeRange),
    limit: normalizeNumberOption(rawOptions?.limit),
  };
}

function normalizeReadOptions(rawOptions) {
  return {
    contentLimit: normalizeNumberOption(rawOptions?.contentLimit),
    retries: normalizeNumberOption(rawOptions?.retries),
  };
}

function normalizeOptionString(value) {
  if (typeof value !== 'string') return undefined;
  if (value.length > MAX_IPC_OPTION_CHARS) return undefined;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= MAX_IPC_OPTION_CHARS ? trimmed : undefined;
}

function normalizeNumberOption(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value !== 'string' || value.length > MAX_IPC_OPTION_CHARS) {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  if (!DECIMAL_NUMBER_PATTERN.test(trimmed)) {
    return undefined;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeSearchQuery(query) {
  if (typeof query !== 'string') {
    throw new WebSearchError('invalid_query', 'Search query is required.');
  }
  if (query.length > MAX_WEB_SEARCH_QUERY_CHARS) {
    throw new WebSearchError('invalid_query', 'Search query is required.');
  }
  const trimmed = query.trim();
  if (!trimmed || trimmed.length > MAX_WEB_SEARCH_QUERY_CHARS) {
    throw new WebSearchError('invalid_query', 'Search query is required.');
  }
  return trimmed;
}

function normalizeReadUrl(url) {
  if (typeof url !== 'string') {
    throw new WebSearchError('invalid_url', 'Invalid URL.');
  }
  if (url.length > MAX_IPC_READ_URL_CHARS) {
    throw new WebSearchError('invalid_url', 'Invalid URL.');
  }
  const trimmed = url.trim();
  if (!trimmed || trimmed.length > MAX_IPC_READ_URL_CHARS) {
    throw new WebSearchError('invalid_url', 'Invalid URL.');
  }
  return trimmed;
}

function normalizeReadUrls(urls) {
  const inputUrls = Array.isArray(urls) ? urls : [urls];
  return inputUrls.slice(0, MAX_IPC_BATCH_READ_URLS).map(normalizeReadUrl);
}

export function createWebSearchServices({ fetchImpl } = {}) {
  return {
    searchService: new SearchService({
      providers: [
        new LocalSearchProvider({ fetchImpl }),
      ],
    }),
    crawler: new Crawler({ fetchImpl }),
  };
}

export function registerWebSearchIpc({
  handleIpc,
  services = createWebSearchServices(),
}) {
  const pendingRequests = new Map();
  const beginRequest = (requestId) => {
    const safeRequestId = normalizeRequestId(requestId);
    if (!safeRequestId) return { signal: undefined, finish: () => {} };
    pendingRequests.get(safeRequestId)?.abort();
    const controller = new AbortController();
    pendingRequests.set(safeRequestId, controller);
    return {
      signal: controller.signal,
      finish: () => {
        if (pendingRequests.get(safeRequestId) === controller) {
          pendingRequests.delete(safeRequestId);
        }
      },
    };
  };

  handleIpc('desktop:web-search:search', async (_event, query, options, requestId) => {
    const request = beginRequest(requestId);
    try {
      const result = await services.searchService.webSearch(normalizeSearchQuery(query), {
        ...normalizeSearchOptions(options),
        signal: request.signal,
      });
      throwIfAborted(request.signal);
      return result;
    } finally {
      request.finish();
    }
  });

  handleIpc('desktop:web-search:read', async (_event, url, options, requestId) => {
    const request = beginRequest(requestId);
    try {
      const [result] = await readUrlsBatch(services.crawler, [normalizeReadUrl(url)], {
        ...normalizeReadOptions(options),
        signal: request.signal,
      });
      throwIfAborted(request.signal);
      if (result?.ok && result.page) {
        return result.page;
      }
      const error = new Error(result?.error || 'Unable to read this page.');
      error.code = result?.code || 'read_failed';
      throw error;
    } finally {
      request.finish();
    }
  });

  handleIpc('desktop:web-search:read-batch', async (_event, urls, options, requestId) => {
    const request = beginRequest(requestId);
    try {
      const results = await readUrlsBatch(services.crawler, normalizeReadUrls(urls), {
        ...normalizeReadOptions(options),
        signal: request.signal,
      });
      throwIfAborted(request.signal);
      return results;
    } finally {
      request.finish();
    }
  });

  handleIpc('desktop:web-search:cancel', async (_event, requestId) => {
    const safeRequestId = normalizeRequestId(requestId);
    if (!safeRequestId) return false;
    const controller = pendingRequests.get(safeRequestId);
    if (!controller) return false;
    controller.abort();
    pendingRequests.delete(safeRequestId);
    return true;
  });
}
