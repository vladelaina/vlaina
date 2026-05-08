import { Crawler } from './crawler/index.mjs';
import { readUrlsBatch } from './crawler/batchCrawler.mjs';
import { SearchService } from './searchService.mjs';
import { LocalSearchProvider } from './providers/localSearchProvider.mjs';

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
  handleIpc('desktop:web-search:search', async (_event, query, options) => {
    return services.searchService.webSearch(query, normalizeSearchOptions(options));
  });

  handleIpc('desktop:web-search:read', async (_event, url, options) => {
    const [result] = await readUrlsBatch(services.crawler, [url], normalizeReadOptions(options));
    if (result?.ok && result.page) {
      return result.page;
    }
    const error = new Error(result?.error || 'Unable to read this page.');
    error.code = result?.code || 'read_failed';
    throw error;
  });

  handleIpc('desktop:web-search:read-batch', async (_event, urls, options) => {
    return readUrlsBatch(services.crawler, urls, normalizeReadOptions(options));
  });
}
