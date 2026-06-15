import { cleanText } from '../crawler/contentExtraction.mjs';
import { getExcludedSitesForQuery } from '../sourceQuality/searchQualityPolicy.mjs';
import { buildAllSourceHints, buildOfficialSourceHints } from '../sourceHints/index.mjs';
import { filterLowRelevanceResults, getMeaningfulTerms, getQueryMatchScore } from '../searchRelevance.mjs';
import { isBlockedResultUrl, normalizeResultUrl } from '../searchResultUrlPolicy.mjs';
import { DEFAULT_SEARCH_LIMIT, WebSearchError, normalizeLimit } from '../types.mjs';

const SEARCH_ENGINES = [
  {
    id: 'google',
    url: 'https://www.google.com/search',
    params(query, limit, options) {
      return {
        q: query,
        num: String(Math.max(limit * 3, 10)),
        hl: 'en',
        gl: 'us',
        pws: '0',
        ...buildTimeRangeParams('google', options.timeRange),
      };
    },
  },
  {
    id: 'bing',
    url: 'https://www.bing.com/search',
    params(query, limit, options) {
      return {
        q: query,
        count: String(Math.max(limit * 3, 10)),
        mkt: 'en-US',
        setlang: 'en-US',
        cc: 'US',
        ensearch: '1',
        ...buildTimeRangeParams('bing', options.timeRange),
      };
    },
  },
  {
    id: 'duckduckgo',
    url: 'https://html.duckduckgo.com/html/',
    params(query, _limit, options) {
      return {
        q: query,
        ...buildTimeRangeParams('duckduckgo', options.timeRange),
      };
    },
  },
];
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const SEARCH_TIMEOUT_MS = 8000;
const OFFICIAL_HINT_GRACE_MS = 500;
const ENGINE_FALLBACK_GRACE_MS = 500;
const MAX_SEARCH_RESPONSE_TEXT_BYTES = 1_000_000;

function createAbortError() {
  return new DOMException('The web search request was cancelled.', 'AbortError');
}

function throwIfAborted(signal) {
  if (!signal?.aborted) return;
  throw createAbortError();
}

async function raceWithAbort(promise, signal) {
  if (!signal) return await promise;
  throwIfAborted(signal);
  promise.catch(() => undefined);

  return await new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      signal.removeEventListener('abort', abort);
    };
    const settle = (callback) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback();
    };
    const abort = () => {
      settle(() => reject(createAbortError()));
    };

    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) {
      abort();
      return;
    }

    promise.then(
      (value) => {
        settle(() => {
          try {
            throwIfAborted(signal);
            resolve(value);
          } catch (error) {
            reject(error);
          }
        });
      },
      (error) => {
        settle(() => {
          try {
            throwIfAborted(signal);
            reject(error);
          } catch (abortError) {
            reject(abortError);
          }
        });
      },
    );
  });
}

async function readResponseText(response, signal) {
  throwIfAborted(signal);
  if (!response.body) {
    if (typeof response.text !== 'function') {
      return '';
    }
    const text = await raceWithAbort(response.text(), signal);
    throwIfAborted(signal);
    if (Buffer.byteLength(text, 'utf8') > MAX_SEARCH_RESPONSE_TEXT_BYTES) {
      throw new WebSearchError('response_too_large', 'Search response is too large.');
    }
    return text;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytesRead = 0;
  let text = '';
  const cancelReader = () => {
    void reader.cancel(createAbortError()).catch(() => undefined);
  };
  signal?.addEventListener('abort', cancelReader, { once: true });

  try {
    while (true) {
      const { done, value } = await raceWithAbort(reader.read(), signal);
      throwIfAborted(signal);
      if (done) {
        break;
      }

      bytesRead += value.byteLength;
      if (bytesRead > MAX_SEARCH_RESPONSE_TEXT_BYTES) {
        void reader.cancel().catch(() => undefined);
        throw new WebSearchError('response_too_large', 'Search response is too large.');
      }
      text += decoder.decode(value, { stream: true });
    }

    return text + decoder.decode();
  } finally {
    signal?.removeEventListener('abort', cancelReader);
    reader.releaseLock();
  }
}

function buildSearchQuery(query, options) {
  const parts = [
    query,
    ...getExcludedSitesForQuery(query).map((site) => `-site:${site}`),
    '-site:player.bilibili.com',
    '-site:bilibili.com/video',
  ];
  if (options.category === 'news' && !/\bnews\b/i.test(query)) {
    parts.push('news');
  }
  return parts.join(' ');
}

function shouldUseFastOfficialHints(query, options, officialResults) {
  if (officialResults.length === 0) return false;
  if (options.category === 'news' || options.timeRange) return false;

  const normalizedQuery = String(query).toLowerCase();
  const asksForFreshSearch = /(\b(today|breaking|current|recent|latest|updated|updates?|news|this week|this month|this year|just released|newly released|release notes?)\b|今天|今日|最新|最近|新闻|资讯|本周|本月|今年|刚发布|新发布|更新|版本说明|发布说明)/.test(normalizedQuery);
  return !asksForFreshSearch;
}

function hasStrongOfficialHint(query, officialResults) {
  const terms = getMeaningfulTerms(query);
  if (terms.length === 0) return false;

  const minimumScore = Math.min(3, terms.length);
  return officialResults.some((result) =>
    getQueryMatchScore(query, `${result.title} ${result.snippet} ${result.url}`) >= minimumScore);
}

function shouldUseOfficialHintGrace(query, options, officialResults) {
  if (officialResults.length === 0) return false;
  if (options.category === 'news' || options.timeRange) return false;
  return hasStrongOfficialHint(query, officialResults);
}

function buildTimeRangeParams(engineId, timeRange) {
  const normalizedRange = String(timeRange || '').toLowerCase();
  if (!['day', 'week', 'month', 'year'].includes(normalizedRange)) {
    return {};
  }

  if (engineId === 'google') {
    const value = { day: 'd', week: 'w', month: 'm', year: 'y' }[normalizedRange];
    return { tbs: `qdr:${value}` };
  }

  if (engineId === 'bing') {
    const value = { day: 'Day', week: 'Week', month: 'Month', year: 'Year' }[normalizedRange];
    return { freshness: value };
  }

  const value = { day: 'd', week: 'w', month: 'm', year: 'y' }[normalizedRange];
  return { df: value };
}

function extractPublishedAt(snippet) {
  const match = snippet.match(/^([A-Z][a-z]{2}\s+\d{1,2},\s+\d{4}|\d{4}\u5e74\d{1,2}\u6708\d{1,2}\u65e5)\s*[·•\u2002\s-]*/);
  return match ? match[1] : null;
}

function collectBingBlocks(html) {
  return [...String(html).matchAll(/<li class="b_algo[\s\S]*?<\/li>/g)].map((match) => match[0]);
}

function collectGoogleBlocks(html) {
  const input = String(html);
  const matches = [...input.matchAll(/<a[^>]*href="([^"]+)"[^>]*>\s*<h3[^>]*>([\s\S]*?)<\/h3>/gi)];
  return matches
    .map((match, index) => ({
      url: match[1],
      title: match[2],
      block: input.slice(match.index ?? 0, matches[index + 1]?.index ?? input.length),
    }));
}

function collectDuckDuckGoBlocks(html) {
  const input = String(html);
  const matches = [...input.matchAll(/<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)];
  return matches
    .map((match, index) => ({
      url: match[1],
      title: match[2],
      block: input.slice(match.index ?? 0, matches[index + 1]?.index ?? input.length),
    }));
}

function extractResultSnippet(block, title) {
  const patterns = [
    /<(?:a|div|span)[^>]*class="[^"]*(?:result__snippet|VwiC3b|IsZvec|BNeawe|st|snippet)[^"]*"[^>]*>([\s\S]*?)<\/(?:a|div|span)>/i,
    /<(?:a|div|span)[^>]*class='[^']*(?:result__snippet|VwiC3b|IsZvec|BNeawe|st|snippet)[^']*'[^>]*>([\s\S]*?)<\/(?:a|div|span)>/i,
    /<p[^>]*>([\s\S]*?)<\/p>/i,
  ];
  const cleanTitle = cleanText(title);
  for (const pattern of patterns) {
    const snippet = cleanText((block.match(pattern) || [])[1] || '');
    if (snippet && snippet !== cleanTitle) {
      return snippet;
    }
  }
  return '';
}

function parseResultItems(items, limit, existingUrls = new Set(), options = {}) {
  const results = [];
  const seenUrls = new Set(existingUrls);
  const minQueryScore = Number(options.minQueryScore) || 0;

  for (const item of items) {
    const url = normalizeResultUrl(item.url);
    if (!url || seenUrls.has(url)) continue;
    if (isBlockedResultUrl(url, { query: options.query })) continue;
    const title = cleanText(item.title);
    const snippet = extractResultSnippet(item.block, title);
    if (!title) continue;
    if (minQueryScore > 0 && getQueryMatchScore(options.query, `${title} ${snippet}`) < minQueryScore) continue;

    seenUrls.add(url);
    results.push({
      title,
      url,
      snippet,
      publishedAt: extractPublishedAt(snippet),
      source: `local-web-search:${options.engine || 'unknown'}`,
      thumbnail: null,
    });

    if (results.length >= limit) break;
  }

  return results;
}

function parseBingResults(html, limit, existingUrls = new Set(), options = {}) {
  const items = collectBingBlocks(html).map((block) => {
    const anchorMatch = block.match(/<h2[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    return anchorMatch
      ? { url: anchorMatch[1], title: anchorMatch[2], block }
      : null;
  }).filter(Boolean);
  return parseResultItems(items, limit, existingUrls, { ...options, engine: 'bing' });
}

function parseGoogleResults(html, limit, existingUrls = new Set(), options = {}) {
  return parseResultItems(collectGoogleBlocks(html), limit, existingUrls, { ...options, engine: 'google' });
}

function parseDuckDuckGoResults(html, limit, existingUrls = new Set(), options = {}) {
  return parseResultItems(collectDuckDuckGoBlocks(html), limit, existingUrls, { ...options, engine: 'duckduckgo' });
}

function parseResults(engine, html, limit, existingUrls = new Set(), options = {}) {
  if (engine === 'google') return parseGoogleResults(html, limit, existingUrls, options);
  if (engine === 'duckduckgo') return parseDuckDuckGoResults(html, limit, existingUrls, options);
  return parseBingResults(html, limit, existingUrls, options);
}

function extractHtmlTitle(html) {
  const title = cleanText((String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '');
  return title || null;
}

function getSingleBrandLikeTerm(query) {
  const normalizedQuery = String(query).toLowerCase();
  const terms = [...new Set(getMeaningfulTerms(query))]
    .filter((term) => /^[a-z0-9][a-z0-9-]{2,30}$/.test(term));
  if (terms.length !== 1) return null;

  const term = terms[0];
  const hasExplicitSiteIntent = /(\b(official|site|website|homepage|download|app|github|repo|repository|docs?|documentation)\b|\u5b98\u7f51|\u5b98\u65b9|\u4e0b\u8f7d|\u5e94\u7528|\u4ed3\u5e93|\u6e90\u7801|\u6587\u6863)/.test(normalizedQuery);
  const looksInvented = /\d|-/.test(term)
    || /^(vl|vr|xr|xq|qw|zh|xj|xv|zx|zq)/.test(term)
    || /(qq|zz|xx|jx|xj|qz|zq|vk|kv|vy|yv)/.test(term);

  return hasExplicitSiteIntent || looksInvented ? term : null;
}

async function fetchDirectOfficialSite(fetchImpl, query, options = {}) {
  const term = getSingleBrandLikeTerm(query);
  if (!term) return [];

  const url = `https://${term}.com/`;
  const timeoutController = new AbortController();
  const timeoutMs = Math.min(Number(options.timeoutMs) || SEARCH_TIMEOUT_MS, 2500);
  const timeout = setTimeout(() => timeoutController.abort(), timeoutMs);
  const signal = options.signal
    ? AbortSignal.any([options.signal, timeoutController.signal])
    : timeoutController.signal;

  try {
    const response = await raceWithAbort(fetchImpl(url, {
      headers: {
        Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'User-Agent': USER_AGENT,
      },
      cache: 'no-store',
      signal,
    }), signal);
    throwIfAborted(signal);

    if (!response.ok) return [];
    const contentType = response.headers?.get?.('content-type') || '';
    const html = contentType.includes('text/html') ? await readResponseText(response, signal) : '';
    throwIfAborted(signal);
    const title = extractHtmlTitle(html) || term;
    return [{
      title,
      url,
      snippet: `Official website candidate for ${term}.`,
      publishedAt: null,
      source: 'local-web-search:direct-domain',
      thumbnail: null,
    }];
  } catch (error) {
    if (options.signal?.aborted) {
      throw createAbortError();
    }
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

function selectSearchEngines(rawEngines) {
  const requested = Array.isArray(rawEngines)
    ? rawEngines
    : typeof rawEngines === 'string'
      ? rawEngines.split(',')
      : [];
  const requestedIds = new Set(
    requested
      .map((engine) => String(engine).trim().toLowerCase())
      .filter(Boolean)
  );

  if (requestedIds.size === 0) {
    return SEARCH_ENGINES;
  }

  const selected = SEARCH_ENGINES.filter((engine) => requestedIds.has(engine.id));
  return selected.length > 0 ? selected : SEARCH_ENGINES;
}

export class LocalSearchProvider {
  constructor({
    fetchImpl = fetch,
    timeoutMs = SEARCH_TIMEOUT_MS,
    officialHintGraceMs = OFFICIAL_HINT_GRACE_MS,
    engineFallbackGraceMs = ENGINE_FALLBACK_GRACE_MS,
  } = {}) {
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
    this.officialHintGraceMs = Number.isFinite(officialHintGraceMs)
      ? Math.max(0, officialHintGraceMs)
      : OFFICIAL_HINT_GRACE_MS;
    this.engineFallbackGraceMs = Number.isFinite(engineFallbackGraceMs)
      ? Math.max(0, engineFallbackGraceMs)
      : ENGINE_FALLBACK_GRACE_MS;
  }

  isConfigured() {
    return true;
  }

  async search(query, options = {}) {
    throwIfAborted(options.signal);
    const limit = normalizeLimit(options.limit, DEFAULT_SEARCH_LIMIT, 10);
    const officialResults = buildAllSourceHints(query).slice(0, limit);
    if (shouldUseFastOfficialHints(query, options, officialResults)) {
      return officialResults;
    }
    const shouldReturnOfficialHintAfterGrace = shouldUseOfficialHintGrace(query, options, officialResults);
    const existingUrls = new Set(officialResults.map((result) => result.url));
    const searchQuery = buildSearchQuery(query, options);
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
    const directOfficialPromise = fetchDirectOfficialSite(this.fetchImpl, query, {
      signal: directOfficialSignal,
      timeoutMs: this.timeoutMs,
    }).catch((error) => {
      if (directOfficialCancelledByCompletion || options.signal?.aborted) {
        return [];
      }
      throw error;
    });

    const engineAttempts = engines.map((engine) => {
      let cancelledByCompletion = false;
      const params = new URLSearchParams(engine.params(searchQuery, limit, options));
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      const signal = options.signal
        ? AbortSignal.any([options.signal, controller.signal])
        : controller.signal;

      const promise = (async () => {
        try {
          const response = await raceWithAbort(this.fetchImpl(`${engine.url}?${params.toString()}`, {
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
            query,
            minQueryScore: officialResults.length > 0 ? 2 : 0,
          });
          return {
            engineId: engine.id,
            results: filterLowRelevanceResults(query, parsedResults),
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
    });

    const settledEngineIds = new Set();
    const cancelOutstandingEngines = () => {
      for (const attempt of engineAttempts) {
        if (!settledEngineIds.has(attempt.engine.id)) {
          attempt.cancel();
        }
      }
    };

    const summarizeResolvedEngines = (byEngine) => {
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
    };

    const summarizeReadyEngines = (byEngine) => {
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

    const pendingEngineAttempts = new Set(engineAttempts);
    let officialHintGraceTimeout = null;
    let officialHintGracePromise = null;
    let engineFallbackGraceTimeout = null;
    let engineFallbackGracePromise = null;
    const clearOfficialHintGrace = () => {
      if (officialHintGraceTimeout) {
        clearTimeout(officialHintGraceTimeout);
        officialHintGraceTimeout = null;
      }
      officialHintGracePromise = null;
    };
    const clearEngineFallbackGrace = () => {
      if (engineFallbackGraceTimeout) {
        clearTimeout(engineFallbackGraceTimeout);
        engineFallbackGraceTimeout = null;
      }
      engineFallbackGracePromise = null;
    };
    const scheduleEngineFallbackGrace = () => {
      if (engineFallbackGracePromise || pendingEngineAttempts.size === 0) return;
      if (this.engineFallbackGraceMs <= 0) {
        engineFallbackGracePromise = Promise.resolve({ engineFallbackGrace: true });
        return;
      }
      engineFallbackGracePromise = new Promise((resolve) => {
        engineFallbackGraceTimeout = setTimeout(() => {
          engineFallbackGraceTimeout = null;
          resolve({ engineFallbackGrace: true });
        }, this.engineFallbackGraceMs);
      });
    };

    try {
      const byEngine = new Map();
      const pending = new Set(engineAttempts.map((attempt) => attempt.settledPromise));
      officialHintGracePromise = shouldReturnOfficialHintAfterGrace
        ? new Promise((resolve) => {
          officialHintGraceTimeout = setTimeout(() => {
            officialHintGraceTimeout = null;
            resolve({ officialHintGrace: true });
          }, this.officialHintGraceMs);
        })
        : null;
      let summary = {
        hasEnoughResults: false,
        lastError: null,
        relevantResults: [],
        sawSuccessfulSearch: false,
      };

      while (pending.size > 0) {
        const racePromises = [...pending];
        if (officialHintGracePromise) racePromises.push(officialHintGracePromise);
        if (engineFallbackGracePromise) racePromises.push(engineFallbackGracePromise);
        const settled = await Promise.race(racePromises);
        if (settled.officialHintGrace) {
          clearOfficialHintGrace();
          clearEngineFallbackGrace();
          throwIfAborted(options.signal);
          cancelOutstandingEngines();
          cancelDirectOfficial();
          return [...officialResults, ...summary.relevantResults].slice(0, limit);
        }
        if (settled.engineFallbackGrace) {
          const readySummary = summarizeReadyEngines(byEngine);
          clearEngineFallbackGrace();
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
        summary = summarizeResolvedEngines(byEngine);
        if (summary.hasEnoughResults) {
          clearOfficialHintGrace();
          clearEngineFallbackGrace();
          cancelOutstandingEngines();
          cancelDirectOfficial();
          return [...officialResults, ...summary.relevantResults].slice(0, limit);
        }

        const readySummary = summarizeReadyEngines(byEngine);
        if (readySummary.relevantResults.length > 0) {
          scheduleEngineFallbackGrace();
        } else if (
          readySummary.sawSuccessfulSearch
          && !hasDirectOfficialCandidate
          && hasOnlyHigherPriorityPendingEngines(readySummary.lowestPrioritySuccessfulEngineIndex)
        ) {
          scheduleEngineFallbackGrace();
        }
      }

      clearOfficialHintGrace();
      clearEngineFallbackGrace();
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
      clearOfficialHintGrace();
      clearEngineFallbackGrace();
      cancelOutstandingEngines();
      cancelDirectOfficial();
      throw error;
    }
  }
}

export const localSearchInternals = {
  buildOfficialSourceHints,
  buildSearchQuery,
  buildTimeRangeParams,
  filterLowRelevanceResults,
  getQueryMatchScore,
  getMeaningfulTerms,
  isBlockedResultUrl,
  parseBingResults,
  parseDuckDuckGoResults,
  parseGoogleResults,
  parseResults,
  selectSearchEngines,
  shouldUseOfficialHintGrace,
  shouldUseFastOfficialHints,
  getSingleBrandLikeTerm,
  fetchDirectOfficialSite,
};
