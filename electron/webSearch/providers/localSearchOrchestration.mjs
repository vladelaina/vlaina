import { WebSearchError } from '../types.mjs';
import {
  filterLowRelevanceResults,
  parseResults,
} from './localSearchHtmlResults.mjs';
import {
  USER_AGENT,
  createAbortError,
  raceWithAbort,
  readResponseText,
} from './localSearchRequestUtils.mjs';

export function summarizeResolvedEngines(engines, officialResults, existingUrls, limit, byEngine) {
  const relevantResults = [];
  const seenUrls = new Set(existingUrls);
  let lastError = null;
  let sawSuccessfulSearch = false;

  for (const engine of engines) {
    const attempt = byEngine.get(engine.id);
    if (!attempt) {
      break;
    }
    if (attempt.error) {
      lastError = attempt.error;
      continue;
    }
    sawSuccessfulSearch = true;
    for (const result of attempt.results || []) {
      if (seenUrls.has(result.url)) continue;
      seenUrls.add(result.url);
      relevantResults.push(result);
      if (officialResults.length + relevantResults.length >= limit) {
        break;
      }
    }
    if (officialResults.length + relevantResults.length >= limit) {
      break;
    }
  }

  return {
    hasEnoughResults: officialResults.length + relevantResults.length >= limit,
    lastError,
    relevantResults,
    sawSuccessfulSearch,
  };
}

export function summarizeReadyEngines(engines, officialResults, existingUrls, limit, enginePriority, byEngine) {
  const relevantResults = [];
  const seenUrls = new Set(existingUrls);
  let sawSuccessfulSearch = false;
  let lowestPrioritySuccessfulEngineIndex = -1;

  for (const engine of engines) {
    const attempt = byEngine.get(engine.id);
    if (!attempt || attempt.error) continue;
    sawSuccessfulSearch = true;
    lowestPrioritySuccessfulEngineIndex = Math.max(
      lowestPrioritySuccessfulEngineIndex,
      enginePriority.get(engine.id) ?? -1,
    );
    for (const result of attempt.results || []) {
      if (seenUrls.has(result.url)) continue;
      seenUrls.add(result.url);
      relevantResults.push(result);
      if (officialResults.length + relevantResults.length >= limit) {
        break;
      }
    }
  }

  return {
    relevantResults,
    sawSuccessfulSearch,
    lowestPrioritySuccessfulEngineIndex,
  };
}

export function createEngineAttempt(provider, engine, searchQuery, normalizedQuery, limit, officialResults, existingUrls, options) {
  let cancelledByCompletion = false;
  const params = new URLSearchParams(engine.params(searchQuery, limit, options));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), provider.timeoutMs);
  const signal = options.signal
    ? AbortSignal.any([options.signal, controller.signal])
    : controller.signal;

  const promise = (async () => {
    try {
      const response = await raceWithAbort(provider.fetchImpl(`${engine.url}?${params.toString()}`, {
        headers: {
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9',
          'User-Agent': USER_AGENT,
        },
        cache: 'no-store',
        signal,
      }), signal);

      if (!response.ok) {
        throw new WebSearchError('search_unavailable', 'Web search is temporarily unavailable.');
      }

      const parsedResults = parseResults(engine.id, await readResponseText(response, signal), limit - officialResults.length, existingUrls, {
        query: normalizedQuery,
        minQueryScore: officialResults.length > 0 ? 2 : 0,
      });
      return {
        engineId: engine.id,
        results: filterLowRelevanceResults(normalizedQuery, parsedResults),
      };
    } catch (error) {
      if (options.signal?.aborted && !cancelledByCompletion) {
        throw createAbortError();
      }
      return {
        engineId: engine.id,
        error,
      };
    } finally {
      clearTimeout(timeout);
    }
  })();
  const attempt = {
    engine,
    settledPromise: null,
    cancel() {
      cancelledByCompletion = true;
      if (!controller.signal.aborted) controller.abort(createAbortError());
    },
  };
  attempt.settledPromise = promise.then(
    (result) => ({ attempt, result }),
    (error) => ({ attempt, error })
  );
  return attempt;
}

export function createGraceScheduler(delayMs, flagName) {
  let timeout = null;
  let promise = null;

  return {
    get promise() {
      return promise;
    },
    clear() {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      promise = null;
    },
    schedule() {
      if (promise) return;
      if (delayMs <= 0) {
        promise = Promise.resolve({ [flagName]: true });
        return;
      }
      promise = new Promise((resolve) => {
        timeout = setTimeout(() => {
          timeout = null;
          resolve({ [flagName]: true });
        }, delayMs);
      });
    },
  };
}
