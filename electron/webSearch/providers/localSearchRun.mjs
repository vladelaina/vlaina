import { DEFAULT_SEARCH_LIMIT, WebSearchError, normalizeLimit } from '../types.mjs';
import {
  buildSearchQuery,
  normalizeSearchQuery,
  selectSearchEngines,
} from './localSearchEngines.mjs';
import {
  buildOfficialResults,
  fetchDirectOfficialSite,
  getSingleBrandLikeTerm,
  shouldUseFastOfficialHints,
  shouldUseOfficialHintGrace,
} from './localSearchOfficialCandidates.mjs';
import { createAbortError, throwIfAborted } from './localSearchRequestUtils.mjs';
import {
  createEngineAttempt,
  createGraceScheduler,
  summarizeReadyEngines,
  summarizeResolvedEngines,
} from './localSearchOrchestration.mjs';

export async function runLocalSearch(provider, query, options = {}) {
  throwIfAborted(options.signal);
  const normalizedQuery = normalizeSearchQuery(query);
  const limit = normalizeLimit(options.limit, DEFAULT_SEARCH_LIMIT, 10);
  const officialResults = buildOfficialResults(normalizedQuery, limit);
  if (shouldUseFastOfficialHints(normalizedQuery, options, officialResults)) {
    return officialResults;
  }
  const shouldReturnOfficialHintAfterGrace = shouldUseOfficialHintGrace(query, options, officialResults);
  const existingUrls = new Set(officialResults.map((result) => result.url));
  const searchQuery = buildSearchQuery(normalizedQuery, options);
  const engines = selectSearchEngines(options.engines);
  const enginePriority = new Map(engines.map((engine, index) => [engine.id, index]));
  const hasDirectOfficialCandidate = getSingleBrandLikeTerm(query) !== null;
  const directOfficialController = new AbortController();
  let directOfficialCancelledByCompletion = false;
  const directOfficialSignal = options.signal
    ? AbortSignal.any([options.signal, directOfficialController.signal])
    : directOfficialController.signal;
  const cancelDirectOfficial = () => {
    if (!directOfficialController.signal.aborted) {
      directOfficialCancelledByCompletion = true;
      directOfficialController.abort(createAbortError());
    }
  };
  const directOfficialPromise = fetchDirectOfficialSite(provider.fetchImpl, normalizedQuery, {
    signal: directOfficialSignal,
    timeoutMs: provider.timeoutMs,
  }).catch((error) => {
    if (directOfficialCancelledByCompletion || options.signal?.aborted) {
      return [];
    }
    throw error;
  });

  const engineAttempts = engines.map((engine) =>
    createEngineAttempt(provider, engine, searchQuery, normalizedQuery, limit, officialResults, existingUrls, options));
  const settledEngineIds = new Set();
  const pendingEngineAttempts = new Set(engineAttempts);
  const cancelOutstandingEngines = () => {
    for (const attempt of engineAttempts) {
      if (!settledEngineIds.has(attempt.engine.id)) {
        attempt.cancel();
      }
    }
  };
  const hasOnlyHigherPriorityPendingEngines = (lowestPrioritySuccessfulEngineIndex) => {
    if (lowestPrioritySuccessfulEngineIndex < 0 || pendingEngineAttempts.size === 0) return false;
    for (const attempt of pendingEngineAttempts) {
      const index = enginePriority.get(attempt.engine.id) ?? Number.MAX_SAFE_INTEGER;
      if (index > lowestPrioritySuccessfulEngineIndex) {
        return false;
      }
    }
    return true;
  };
  const officialHintGrace = createGraceScheduler(
    shouldReturnOfficialHintAfterGrace ? provider.officialHintGraceMs : Number.POSITIVE_INFINITY,
    'officialHintGrace',
  );
  const engineFallbackGrace = createGraceScheduler(provider.engineFallbackGraceMs, 'engineFallbackGrace');

  try {
    const byEngine = new Map();
    const pending = new Set(engineAttempts.map((attempt) => attempt.settledPromise));
    if (shouldReturnOfficialHintAfterGrace) officialHintGrace.schedule();
    let summary = {
      hasEnoughResults: false,
      lastError: null,
      relevantResults: [],
      sawSuccessfulSearch: false,
    };

    while (pending.size > 0) {
      const racePromises = [...pending];
      if (officialHintGrace.promise) racePromises.push(officialHintGrace.promise);
      if (engineFallbackGrace.promise) racePromises.push(engineFallbackGrace.promise);
      const settled = await Promise.race(racePromises);
      if (settled.officialHintGrace) {
        officialHintGrace.clear();
        engineFallbackGrace.clear();
        throwIfAborted(options.signal);
        cancelOutstandingEngines();
        cancelDirectOfficial();
        return [...officialResults, ...summary.relevantResults].slice(0, limit);
      }
      if (settled.engineFallbackGrace) {
        const readySummary = summarizeReadyEngines(engines, officialResults, existingUrls, limit, enginePriority, byEngine);
        engineFallbackGrace.clear();
        throwIfAborted(options.signal);
        cancelOutstandingEngines();
        cancelDirectOfficial();
        return [...officialResults, ...readySummary.relevantResults].slice(0, limit);
      }
      pending.delete(settled.attempt.settledPromise);
      pendingEngineAttempts.delete(settled.attempt);
      settledEngineIds.add(settled.attempt.engine.id);
      if (settled.error) {
        throw settled.error;
      }
      byEngine.set(settled.result.engineId, settled.result);
      throwIfAborted(options.signal);
      summary = summarizeResolvedEngines(engines, officialResults, existingUrls, limit, byEngine);
      if (summary.hasEnoughResults) {
        officialHintGrace.clear();
        engineFallbackGrace.clear();
        cancelOutstandingEngines();
        cancelDirectOfficial();
        return [...officialResults, ...summary.relevantResults].slice(0, limit);
      }

      const readySummary = summarizeReadyEngines(engines, officialResults, existingUrls, limit, enginePriority, byEngine);
      if (readySummary.relevantResults.length > 0) {
        engineFallbackGrace.schedule();
      } else if (
        readySummary.sawSuccessfulSearch
        && !hasDirectOfficialCandidate
        && hasOnlyHigherPriorityPendingEngines(readySummary.lowestPrioritySuccessfulEngineIndex)
      ) {
        engineFallbackGrace.schedule();
      }
    }

    officialHintGrace.clear();
    engineFallbackGrace.clear();
    if (summary.relevantResults.length > 0 || officialResults.length > 0) {
      throwIfAborted(options.signal);
      cancelDirectOfficial();
      return [...officialResults, ...summary.relevantResults].slice(0, limit);
    }

    const directOfficialResults = await directOfficialPromise;
    throwIfAborted(options.signal);
    if (directOfficialResults.length > 0) {
      return directOfficialResults.slice(0, limit);
    }

    if (summary.sawSuccessfulSearch) {
      throwIfAborted(options.signal);
      return [];
    }

    throw new WebSearchError('search_unavailable', 'Web search is temporarily unavailable.', summary.lastError);
  } catch (error) {
    officialHintGrace.clear();
    engineFallbackGrace.clear();
    cancelOutstandingEngines();
    cancelDirectOfficial();
    throw error;
  }
}
