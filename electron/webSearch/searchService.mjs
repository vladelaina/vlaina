import { DEFAULT_SEARCH_LIMIT, WebSearchError, normalizeLimit } from './types.mjs';

function throwIfAborted(signal) {
  if (!signal?.aborted) return;
  throw new DOMException('The web search request was cancelled.', 'AbortError');
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

function searchProviderAttempts(provider, query, attempts) {
  return new Promise((resolve, reject) => {
    let remaining = attempts.length;
    let lastError = null;
    let sawEmptyResult = false;
    let settled = false;

    const finishIfDone = () => {
      if (settled || remaining > 0) return;
      settled = true;
      resolve({ results: [], sawEmptyResult, lastError });
    };

    for (const attempt of attempts) {
      try {
        throwIfAborted(attempt.signal);
      } catch (error) {
        reject(error);
        return;
      }

      provider.search(query, attempt)
        .then((results) => {
          if (settled) return;
          if (Array.isArray(results) && results.length > 0) {
            settled = true;
            resolve({ results, sawEmptyResult: true, lastError });
            return;
          }
          sawEmptyResult = true;
          remaining -= 1;
          finishIfDone();
        })
        .catch((error) => {
          if (settled) return;
          if (isAbortError(error)) {
            settled = true;
            reject(error);
            return;
          }
          if (error instanceof WebSearchError && error.code === 'invalid_query') {
            settled = true;
            reject(error);
            return;
          }
          lastError = error;
          remaining -= 1;
          finishIfDone();
        });
    }
  });
}

export class SearchService {
  constructor({ providers }) {
    this.providers = providers.filter((provider) => provider?.isConfigured?.());
  }

  async webSearch(query, options = {}) {
    throwIfAborted(options.signal);
    const normalizedQuery = String(query ?? '').trim();
    if (!normalizedQuery) {
      throw new WebSearchError('invalid_query', 'Search query is required.');
    }

    const limit = normalizeLimit(options.limit, DEFAULT_SEARCH_LIMIT, 10);
    const attempts = buildSearchAttempts(options, limit);

    if (this.providers.length === 0) {
      throw new WebSearchError('search_unavailable', 'Web search is temporarily unavailable.');
    }

    let lastProviderError = null;
    let sawAnyEmptyResult = false;
    for (const provider of this.providers) {
      throwIfAborted(options.signal);
      const result = await searchProviderAttempts(provider, normalizedQuery, attempts);
      if (result.results.length > 0) {
        return { query: normalizedQuery, results: result.results };
      }
      lastProviderError = result.lastError;
      sawAnyEmptyResult = sawAnyEmptyResult || result.sawEmptyResult;
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
