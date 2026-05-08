export {
  HARD_BLOCKED_SITES as DEFAULT_EXCLUDED_SITES,
  HARD_BLOCKED_SITES,
  LOW_PRIORITY_SITES,
  QUERY_SENSITIVE_BLOCKED_SITES,
  getExcludedSitesForQuery,
  getQuerySensitiveBlockedSites,
  isHostMatched,
} from './sourceQualityPolicy.mjs';

import { HARD_BLOCKED_SITES } from './sourceQualityPolicy.mjs';

export const BLOCKED_RESULT_HOSTS = new Set(HARD_BLOCKED_SITES);
