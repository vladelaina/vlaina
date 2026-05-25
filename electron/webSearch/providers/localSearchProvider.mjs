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

function createAbortError() {
  return new DOMException('The web search request was cancelled.', 'AbortError');
}

function throwIfAborted(signal) {
  if (!signal?.aborted) return;
  throw createAbortError();
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
  return [...String(html).matchAll(/<a[^>]*href="([^"]+)"[^>]*>\s*<h3[^>]*>([\s\S]*?)<\/h3>/gi)]
    .map((match) => ({
      url: match[1],
      title: match[2],
      block: match[0],
    }));
}

function collectDuckDuckGoBlocks(html) {
  return [...String(html).matchAll(/<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => ({
      url: match[1],
      title: match[2],
      block: match[0],
    }));
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
    const snippet = cleanText((item.block.match(/<p[^>]*>([\s\S]*?)<\/p>/i) || [])[1] || '');
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
  const controller = new AbortController();
  const timeoutMs = Math.min(Number(options.timeoutMs) || SEARCH_TIMEOUT_MS, 2500);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const signal = options.signal
    ? AbortSignal.any([options.signal, controller.signal])
    : controller.signal;

  try {
    const response = await fetchImpl(url, {
      headers: {
        Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'User-Agent': USER_AGENT,
      },
      cache: 'no-store',
      signal,
    });

    if (!response.ok) return [];
    const contentType = response.headers?.get?.('content-type') || '';
    const html = contentType.includes('text/html') ? await response.text() : '';
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
  constructor({ fetchImpl = fetch, timeoutMs = SEARCH_TIMEOUT_MS } = {}) {
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
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
    const existingUrls = new Set(officialResults.map((result) => result.url));
    const searchQuery = buildSearchQuery(query, options);
    const engines = selectSearchEngines(options.engines);
    const directOfficialPromise = fetchDirectOfficialSite(this.fetchImpl, query, {
      signal: options.signal,
      timeoutMs: this.timeoutMs,
    });

    const engineAttempts = engines.map(async (engine) => {
      const params = new URLSearchParams(engine.params(searchQuery, limit, options));
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      const signal = options.signal
        ? AbortSignal.any([options.signal, controller.signal])
        : controller.signal;

      try {
        const response = await this.fetchImpl(`${engine.url}?${params.toString()}`, {
          headers: {
            Accept: 'text/html,application/xhtml+xml',
            'Accept-Language': 'en-US,en;q=0.9',
            'User-Agent': USER_AGENT,
          },
          cache: 'no-store',
          signal,
        });

        if (!response.ok) {
          throw new WebSearchError('search_unavailable', 'Web search is temporarily unavailable.');
        }

        const parsedResults = parseResults(engine.id, await response.text(), limit - officialResults.length, existingUrls, {
          query,
          minQueryScore: officialResults.length > 0 ? 2 : 0,
        });
        return {
          engineId: engine.id,
          results: filterLowRelevanceResults(query, parsedResults),
        };
      } catch (error) {
        if (options.signal?.aborted) {
          throw createAbortError();
        }
        return {
          engineId: engine.id,
          error,
        };
      } finally {
        clearTimeout(timeout);
      }
    });

    const settledAttempts = await Promise.all(engineAttempts);
    throwIfAborted(options.signal);
    const byEngine = new Map(settledAttempts.map((attempt) => [attempt.engineId, attempt]));
    const relevantResults = [];
    const seenUrls = new Set(existingUrls);
    let lastError = null;
    let sawSuccessfulSearch = false;

    for (const engine of engines) {
      const attempt = byEngine.get(engine.id);
      if (!attempt) continue;
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

    if (relevantResults.length > 0 || officialResults.length > 0) {
      return [...officialResults, ...relevantResults].slice(0, limit);
    }

    const directOfficialResults = await directOfficialPromise;
    if (directOfficialResults.length > 0) {
      return directOfficialResults.slice(0, limit);
    }

    if (sawSuccessfulSearch) {
      return [];
    }

    throw new WebSearchError('search_unavailable', 'Web search is temporarily unavailable.', lastError);
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
  shouldUseFastOfficialHints,
  getSingleBrandLikeTerm,
  fetchDirectOfficialSite,
};
