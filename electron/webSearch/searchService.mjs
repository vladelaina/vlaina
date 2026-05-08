import { DEFAULT_SEARCH_LIMIT, WebSearchError, normalizeLimit } from './types.mjs';

function buildSearchAttempts(options, limit) {
  const attempts = [];
  const seen = new Set();
  const addAttempt = (attempt) => {
    const key = JSON.stringify({
      category: attempt.category,
      engines: attempt.engines,
      limit: attempt.limit,
      timeRange: attempt.timeRange,
    });
    if (!seen.has(key)) {
      seen.add(key);
      attempts.push(attempt);
    }
  };

  addAttempt({ ...options, limit });
  if (options.engines) {
    addAttempt({ ...options, engines: undefined, limit });
  }
  if (options.category || options.engines || options.timeRange) {
    addAttempt({ limit });
  }

  return attempts;
}

export class SearchService {
  constructor({ providers }) {
    this.providers = providers.filter((provider) => provider?.isConfigured?.());
  }

  async webSearch(query, options = {}) {
    const normalizedQuery = String(query ?? '').trim();
    if (!normalizedQuery) {
      throw new WebSearchError('invalid_query', 'Search query is required.');
    }

    const limit = normalizeLimit(options.limit, DEFAULT_SEARCH_LIMIT, 10);
    const attempts = buildSearchAttempts(options, limit);

    let lastError = null;
    let sawEmptyResult = false;
    for (const provider of this.providers) {
      for (const attempt of attempts) {
        try {
          const results = await provider.search(normalizedQuery, attempt);
          if (results.length > 0) {
            return { query: normalizedQuery, results };
          }
          sawEmptyResult = true;
        } catch (error) {
          lastError = error;
          if (error instanceof WebSearchError && error.code === 'invalid_query') {
            throw error;
          }
        }
      }
    }

    if (this.providers.length === 0) {
      throw new WebSearchError('search_unavailable', 'Web search is temporarily unavailable.', lastError);
    }

    if (lastError && !sawEmptyResult) {
      throw new WebSearchError('search_unavailable', 'Web search is temporarily unavailable.', lastError);
    }

    return { query: normalizedQuery, results: [] };
  }
}

export const searchServiceInternals = {
  buildSearchAttempts,
};
