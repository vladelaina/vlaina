import { Crawler } from './crawler/index.mjs';
import { readUrlsBatch } from './crawler/batchCrawler.mjs';
import { SearchService } from './searchService.mjs';
import { LocalSearchProvider } from './providers/localSearchProvider.mjs';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,160}$/;

function normalizeRequestId(rawRequestId) {
  const requestId = String(rawRequestId ?? '').trim();
  return REQUEST_ID_PATTERN.test(requestId) ? requestId : null;
}

function normalizeSearchOptions(rawOptions) {
  return {
    category: typeof rawOptions?.category === 'string' ? rawOptions.category : undefined,
    timeRange: typeof rawOptions?.timeRange === 'string' ? rawOptions.timeRange : undefined,
    limit: rawOptions?.limit,
  };
}

function normalizeReadOptions(rawOptions) {
  return {
    contentLimit: rawOptions?.contentLimit,
    retries: rawOptions?.retries,
  };
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
      return await services.searchService.webSearch(query, {
        ...normalizeSearchOptions(options),
        signal: request.signal,
      });
    } finally {
      request.finish();
    }
  });

  handleIpc('desktop:web-search:read', async (_event, url, options, requestId) => {
    const request = beginRequest(requestId);
    try {
      const [result] = await readUrlsBatch(services.crawler, [url], {
        ...normalizeReadOptions(options),
        signal: request.signal,
      });
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
      return await readUrlsBatch(services.crawler, urls, {
        ...normalizeReadOptions(options),
        signal: request.signal,
      });
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
