import {
  DEFAULT_SEARCH_LIMIT,
  MAX_WEB_SEARCH_QUERY_CHARS,
  WebSearchError,
  normalizeLimit,
} from './types.mjs';

function createAbortError() {
  return new DOMException('The web search request was cancelled.', 'AbortError');
}

function throwIfAborted(signal) {
  if (signal?.aborted) throw createAbortError();
}

function isAbortError(error) {
  return error instanceof DOMException && error.name === 'AbortError';
}

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
    if (seen.has(key)) return;
    seen.add(key);
    attempts.push(attempt);
  };

  addAttempt({ ...options, limit });
  if (options.engines) addAttempt({ ...options, engines: undefined, limit });
  if (options.category || options.engines || options.timeRange) addAttempt({ limit });
  return attempts;
}

async function searchProviderAttempts(provider, query, attempts) {
  let lastError = null;
  let sawEmptyResult = false;

  for (const attempt of attempts) {
    throwIfAborted(attempt.signal);
    try {
      const results = await provider.search(query, attempt);
      throwIfAborted(attempt.signal);
      if (Array.isArray(results) && results.length > 0) {
        return { results, sawEmptyResult, lastError };
      }
      sawEmptyResult = true;
    } catch (error) {
      if (isAbortError(error) || attempt.signal?.aborted) throw createAbortError();
      if (error instanceof WebSearchError && error.code === 'invalid_query') throw error;
      lastError = error;
    }
  }

  return { results: [], sawEmptyResult, lastError };
}

export class SearchService {
  constructor({ providers }) {
    this.providers = providers.filter((provider) => provider?.isConfigured?.());
  }

  async webSearch(query, options = {}) {
    throwIfAborted(options.signal);
    const normalizedQuery = typeof query === 'string' && query.length <= MAX_WEB_SEARCH_QUERY_CHARS
      ? query.trim()
      : '';
    if (!normalizedQuery) {
      throw new WebSearchError('invalid_query', 'Search query is required.');
    }

    if (this.providers.length === 0) {
      throw new WebSearchError('search_unavailable', 'Web search is temporarily unavailable.');
    }

    const limit = normalizeLimit(options.limit, DEFAULT_SEARCH_LIMIT, 10);
    const attempts = buildSearchAttempts(options, limit);
    let lastProviderError = null;
    let sawAnyEmptyResult = false;

    for (const provider of this.providers) {
      const result = await searchProviderAttempts(provider, normalizedQuery, attempts);
      throwIfAborted(options.signal);
      if (result.results.length > 0) {
        return { query: normalizedQuery, results: result.results };
      }
      lastProviderError = result.lastError;
      sawAnyEmptyResult ||= result.sawEmptyResult;
    }

    if (lastProviderError && !sawAnyEmptyResult) {
      throw new WebSearchError('search_unavailable', 'Web search is temporarily unavailable.', lastProviderError);
    }

    return { query: normalizedQuery, results: [] };
  }
}

export const searchServiceInternals = {
  buildSearchAttempts,
  searchProviderAttempts,
};
