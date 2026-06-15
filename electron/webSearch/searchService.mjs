import {
  DEFAULT_SEARCH_LIMIT,
  MAX_WEB_SEARCH_QUERY_CHARS,
  WebSearchError,
  normalizeLimit,
} from './types.mjs';

const DEFAULT_FALLBACK_RESULT_GRACE_MS = 1200;

function createAbortError() {
  return new DOMException('The web search request was cancelled.', 'AbortError');
}

function throwIfAborted(signal) {
  if (!signal?.aborted) return;
  throw createAbortError();
}

function isAbortError(error) {
  return error instanceof DOMException && error.name === 'AbortError';
}

function createAttemptSignal(parentSignal, controller, cleanupCallbacks) {
  if (!parentSignal) return controller.signal;
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.any === 'function') {
    return AbortSignal.any([parentSignal, controller.signal]);
  }

  const abortFromParent = () => {
    if (!controller.signal.aborted) controller.abort(createAbortError());
  };
  if (parentSignal.aborted) {
    abortFromParent();
  } else {
    parentSignal.addEventListener('abort', abortFromParent, { once: true });
    cleanupCallbacks.push(() => parentSignal.removeEventListener('abort', abortFromParent));
  }

  return controller.signal;
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

function normalizeGraceMs(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return DEFAULT_FALLBACK_RESULT_GRACE_MS;
  }
  return Math.min(Math.round(parsed), 5000);
}

function searchProviderAttempts(provider, query, attempts, options = {}) {
  return new Promise((resolve, reject) => {
    if (attempts.length === 0) {
      resolve({ results: [], sawEmptyResult: false, lastError: null });
      return;
    }

    const fallbackResultGraceMs = normalizeGraceMs(options.fallbackResultGraceMs);
    let remaining = attempts.length;
    let lastError = null;
    let sawEmptyResult = false;
    let settled = false;
    let fallbackResultTimer = null;
    const attemptStates = attempts.map(() => ({
      done: false,
      results: null,
    }));
    const attemptControllers = new Set();
    const cleanupCallbacks = [];

    const cleanup = () => {
      if (fallbackResultTimer) {
        clearTimeout(fallbackResultTimer);
        fallbackResultTimer = null;
      }
      for (const cleanupCallback of cleanupCallbacks.splice(0)) {
        cleanupCallback();
      }
      attemptControllers.clear();
    };

    const abortOutstandingAttempts = () => {
      for (const controller of attemptControllers) {
        if (!controller.signal.aborted) controller.abort(createAbortError());
      }
    };

    const settleResolve = (value) => {
      if (settled) return;
      settled = true;
      abortOutstandingAttempts();
      cleanup();
      resolve(value);
    };

    const settleReject = (error) => {
      if (settled) return;
      settled = true;
      abortOutstandingAttempts();
      cleanup();
      reject(error);
    };

    const hasPendingHigherPriorityAttempt = (attemptIndex) =>
      attemptStates.slice(0, attemptIndex).some((state) => !state.done);

    const resolveBestReadyResults = ({ allowPendingHigherPriority = false } = {}) => {
      for (let attemptIndex = 0; attemptIndex < attemptStates.length; attemptIndex += 1) {
        const state = attemptStates[attemptIndex];
        if (!Array.isArray(state.results) || state.results.length === 0) continue;
        if (!allowPendingHigherPriority && hasPendingHigherPriorityAttempt(attemptIndex)) return false;
        settleResolve({ results: state.results, sawEmptyResult: true, lastError });
        return true;
      }
      return false;
    };

    const hasReadyResults = () => attemptStates.some((state) =>
      Array.isArray(state.results) && state.results.length > 0);

    const scheduleFallbackResultResolution = () => {
      if (settled || !hasReadyResults()) return;
      if (resolveBestReadyResults()) return;
      if (fallbackResultTimer) return;
      if (fallbackResultGraceMs <= 0) {
        resolveBestReadyResults({ allowPendingHigherPriority: true });
        return;
      }
      fallbackResultTimer = setTimeout(() => {
        fallbackResultTimer = null;
        if (settled) return;
        resolveBestReadyResults({ allowPendingHigherPriority: true });
      }, fallbackResultGraceMs);
    };

    const finishIfDone = () => {
      if (settled || remaining > 0) return;
      if (resolveBestReadyResults()) return;
      settleResolve({ results: [], sawEmptyResult, lastError });
    };

    const parentSignals = new Set(attempts.map((attempt) => attempt.signal).filter(Boolean));
    for (const signal of parentSignals) {
      try {
        throwIfAborted(signal);
      } catch (error) {
        settleReject(error);
        return;
      }

      const abortFromParent = () => settleReject(createAbortError());
      signal.addEventListener('abort', abortFromParent, { once: true });
      cleanupCallbacks.push(() => signal.removeEventListener('abort', abortFromParent));
    }

    for (let attemptIndex = 0; attemptIndex < attempts.length; attemptIndex += 1) {
      const attempt = attempts[attemptIndex];
      try {
        throwIfAborted(attempt.signal);
      } catch (error) {
        settleReject(error);
        return;
      }

      const controller = new AbortController();
      attemptControllers.add(controller);
      const attemptOptions = {
        ...attempt,
        signal: createAttemptSignal(attempt.signal, controller, cleanupCallbacks),
      };

      let searchPromise;
      try {
        searchPromise = Promise.resolve(provider.search(query, attemptOptions));
      } catch (error) {
        searchPromise = Promise.reject(error);
      }

      searchPromise
        .then((results) => {
          attemptControllers.delete(controller);
          if (settled) return;
          try {
            throwIfAborted(attempt.signal);
          } catch (error) {
            settleReject(error);
            return;
          }
          attemptStates[attemptIndex].done = true;
          remaining -= 1;
          if (Array.isArray(results) && results.length > 0) {
            attemptStates[attemptIndex].results = results;
            scheduleFallbackResultResolution();
            return;
          }
          sawEmptyResult = true;
          if (resolveBestReadyResults()) return;
          finishIfDone();
        })
        .catch((error) => {
          attemptControllers.delete(controller);
          if (settled) return;
          if (isAbortError(error)) {
            settleReject(error);
            return;
          }
          if (error instanceof WebSearchError && error.code === 'invalid_query') {
            settleReject(error);
            return;
          }
          attemptStates[attemptIndex].done = true;
          lastError = error;
          remaining -= 1;
          if (resolveBestReadyResults()) return;
          finishIfDone();
        });
    }
  });
}

export class SearchService {
  constructor({ providers, fallbackResultGraceMs = DEFAULT_FALLBACK_RESULT_GRACE_MS }) {
    this.providers = providers.filter((provider) => provider?.isConfigured?.());
    this.fallbackResultGraceMs = normalizeGraceMs(fallbackResultGraceMs);
  }

  async webSearch(query, options = {}) {
    throwIfAborted(options.signal);
    const normalizedQuery = typeof query === 'string' && query.length <= MAX_WEB_SEARCH_QUERY_CHARS
      ? query.trim()
      : '';
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
      const result = await searchProviderAttempts(provider, normalizedQuery, attempts, {
        fallbackResultGraceMs: this.fallbackResultGraceMs,
      });
      throwIfAborted(options.signal);
      if (result.results.length > 0) {
        return { query: normalizedQuery, results: result.results };
      }
      lastProviderError = result.lastError;
      sawAnyEmptyResult = sawAnyEmptyResult || result.sawEmptyResult;
    }

    if (lastProviderError && !sawAnyEmptyResult) {
      throw new WebSearchError('search_unavailable', 'Web search is temporarily unavailable.', lastProviderError);
    }

    throwIfAborted(options.signal);
    return { query: normalizedQuery, results: [] };
  }
}

export const searchServiceInternals = {
  buildSearchAttempts,
  DEFAULT_FALLBACK_RESULT_GRACE_MS,
  searchProviderAttempts,
};
