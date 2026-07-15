import {
  SEARCH_TIMEOUT_MS,
  normalizeSearchTimeoutMs,
} from './localSearchRequestUtils.mjs';
import { runLocalSearch } from './localSearchRun.mjs';
import {
  buildSearchQuery,
  buildTimeRangeParams,
  selectSearchEngines,
} from './localSearchEngines.mjs';
import {
  filterLowRelevanceResults,
  getQueryMatchScore,
  isBlockedResultUrl,
  parseBingResults,
  parseDuckDuckGoResults,
  parseGoogleResults,
  parseResults,
} from './localSearchHtmlResults.mjs';
import {
  buildOfficialSourceHints,
  fetchDirectOfficialSite,
  getMeaningfulTerms,
  getSingleBrandLikeTerm,
  shouldUseFastOfficialHints,
} from './localSearchOfficialCandidates.mjs';

export class LocalSearchProvider {
  constructor({
    fetchImpl = fetch,
    timeoutMs = SEARCH_TIMEOUT_MS,
  } = {}) {
    this.fetchImpl = fetchImpl;
    this.timeoutMs = normalizeSearchTimeoutMs(timeoutMs);
  }

  isConfigured() {
    return true;
  }

  async search(query, options = {}) {
    return runLocalSearch(this, query, options);
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
