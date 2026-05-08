export const DEFAULT_SEARCH_LIMIT = 5;
export const DEFAULT_CONTENT_LIMIT = 12000;
export const DEFAULT_BATCH_CONCURRENCY = 3;
export const DEFAULT_CRAWL_RETRY = 1;

export class WebSearchError extends Error {
  constructor(code, message, cause) {
    super(message);
    this.name = 'WebSearchError';
    this.code = code;
    this.cause = cause;
  }
}

export function normalizeLimit(value, fallback, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(Math.floor(parsed), max);
}
