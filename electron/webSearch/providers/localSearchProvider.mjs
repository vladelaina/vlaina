import {
  ENGINE_FALLBACK_GRACE_MS,
  OFFICIAL_HINT_GRACE_MS,
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
  shouldUseOfficialHintGrace,
} from './localSearchOfficialCandidates.mjs';

export class LocalSearchProvider {
  constructor({
    fetchImpl = fetch,
    timeoutMs = SEARCH_TIMEOUT_MS,
    officialHintGraceMs = OFFICIAL_HINT_GRACE_MS,
    engineFallbackGraceMs = ENGINE_FALLBACK_GRACE_MS,
  } = {}) {
    this.fetchImpl = fetchImpl;
    this.timeoutMs = normalizeSearchTimeoutMs(timeoutMs);
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
  shouldUseOfficialHintGrace,
  shouldUseFastOfficialHints,
  getSingleBrandLikeTerm,
  fetchDirectOfficialSite,
};
