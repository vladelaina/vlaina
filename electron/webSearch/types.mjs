export const DEFAULT_SEARCH_LIMIT = 5;
export const DEFAULT_CONTENT_LIMIT = 12000;
export const DEFAULT_BATCH_CONCURRENCY = 3;
export const DEFAULT_CRAWL_RETRY = 1;
export const MAX_WEB_SEARCH_QUERY_CHARS = 1000;
const MAX_NUMERIC_OPTION_CHARS = 64;
const DECIMAL_NUMBER_PATTERN = /^-?(?:\d+(?:\.\d+)?|\.\d+)$/;

export class WebSearchError extends Error {
  constructor(code, message, cause) {
    super(message);
    this.name = 'WebSearchError';
    this.code = code;
    this.cause = cause;
  }
}

export function normalizeLimit(value, fallback, max) {
  let parsed;
  if (typeof value === 'number') {
    parsed = value;
  } else if (typeof value === 'string' && value.length <= MAX_NUMERIC_OPTION_CHARS) {
    const trimmed = value.trim();
    parsed = DECIMAL_NUMBER_PATTERN.test(trimmed) ? Number(trimmed) : NaN;
  } else {
    parsed = NaN;
  }
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(Math.floor(parsed), max);
}
