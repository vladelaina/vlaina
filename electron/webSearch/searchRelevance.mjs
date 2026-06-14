import { MAX_WEB_SEARCH_QUERY_CHARS } from './types.mjs';

const QUERY_STOPWORDS = new Set([
  'about',
  'and',
  'are',
  'best',
  'docs',
  'documentation',
  'download',
  'editor',
  'for',
  'from',
  'how',
  'install',
  'into',
  'latest',
  'manager',
  'official',
  'package',
  'prompt',
  'release',
  'site',
  'terminal',
  'the',
  'what',
  'when',
  'where',
  'which',
  'who',
  'why',
  'with',
  'website',
]);

const MAX_RELEVANCE_TEXT_CHARS = 20000;

function boundedQueryText(query) {
  return typeof query === 'string' && query.length <= MAX_WEB_SEARCH_QUERY_CHARS ? query : '';
}

function boundedRelevanceText(text) {
  return typeof text === 'string' ? text.slice(0, MAX_RELEVANCE_TEXT_CHARS) : '';
}

function resultSearchText(result) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    return '';
  }
  return [
    boundedRelevanceText(result.title),
    boundedRelevanceText(result.snippet),
    boundedRelevanceText(result.url),
  ].join(' ');
}

export function getMeaningfulTerms(query) {
  return boundedQueryText(query)
    .toLowerCase()
    .match(/[a-z0-9][a-z0-9.-]*/g)
    ?.filter((term) => term.length > 2 && !QUERY_STOPWORDS.has(term)) ?? [];
}

export function getQueryMatchScore(query, text) {
  const normalizedText = boundedRelevanceText(text).toLowerCase();
  return getMeaningfulTerms(query).filter((term) => normalizedText.includes(term)).length;
}

export function filterLowRelevanceResults(query, results) {
  const terms = getMeaningfulTerms(query);
  if (terms.length === 0) {
    return results;
  }
  const minimumScore = Math.min(2, terms.length);

  return results.filter((result) =>
    getQueryMatchScore(query, resultSearchText(result)) >= minimumScore);
}
