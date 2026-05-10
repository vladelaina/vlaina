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
    const limit = normalizeLimit(options.limit, DEFAULT_SEARCH_LIMIT, 10);
    const officialResults = buildAllSourceHints(query).slice(0, limit);
    if (officialResults.length > 0) {
      return officialResults;
    }
    const existingUrls = new Set(officialResults.map((result) => result.url));
    const searchQuery = buildSearchQuery(query, options);
    const engines = selectSearchEngines(options.engines);

    const engineAttempts = engines.map(async (engine) => {
      const params = new URLSearchParams(engine.params(searchQuery, limit, options));
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await this.fetchImpl(`${engine.url}?${params.toString()}`, {
          headers: {
            Accept: 'text/html,application/xhtml+xml',
            'Accept-Language': 'en-US,en;q=0.9',
            'User-Agent': USER_AGENT,
          },
          cache: 'no-store',
          signal: controller.signal,
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
        return {
          engineId: engine.id,
          error,
        };
      } finally {
        clearTimeout(timeout);
      }
    });

    const settledAttempts = await Promise.all(engineAttempts);
    const byEngine = new Map(settledAttempts.map((attempt) => [attempt.engineId, attempt]));
    const relevantResults = [];
    const seenUrls = new Set(existingUrls);
    let lastError = null;

    for (const engine of engines) {
      const attempt = byEngine.get(engine.id);
      if (!attempt) continue;
      if (attempt.error) {
        lastError = attempt.error;
        continue;
      }
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

    if (officialResults.length > 0) return officialResults;
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
};
