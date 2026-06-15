const QUERY_STOPWORDS = new Set([
  'about',
  'and',
  'are',
  'best',
  'breaking',
  'current',
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
  'news',
  'newly',
  'official',
  'package',
  'prompt',
  'recent',
  'release',
  'site',
  'terminal',
  'the',
  'today',
  'updated',
  'updates',
  'what',
  'when',
  'where',
  'which',
  'who',
  'why',
  'with',
  'website',
]);

export function getMeaningfulTerms(query) {
  return String(query)
    .toLowerCase()
    .match(/[a-z0-9][a-z0-9.-]*/g)
    ?.filter((term) => term.length > 2 && !QUERY_STOPWORDS.has(term)) ?? [];
}

export function getQueryMatchScore(query, text) {
  const normalizedText = String(text).toLowerCase();
  return getMeaningfulTerms(query).filter((term) => normalizedText.includes(term)).length;
}

export function filterLowRelevanceResults(query, results) {
  const terms = getMeaningfulTerms(query);
  if (terms.length === 0) {
    return results;
  }
  const minimumScore = Math.min(2, terms.length);

  return results.filter((result) =>
    getQueryMatchScore(query, `${result.title} ${result.snippet} ${result.url}`) >= minimumScore);
}
