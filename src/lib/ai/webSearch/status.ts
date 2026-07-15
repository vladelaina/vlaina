import { isLocalNetworkHttpUrl } from '@/lib/notes/markdown/urlSecurity';
import type { WebSearchStatus } from './types';

const VALID_PHASES = new Set(['searching', 'results', 'reading', 'complete', 'error']);
const MAX_SOURCE_URL_LENGTH = 4096;
const MAX_STORED_WEB_SEARCH_STATUSES = 24;
const HTTP_AUTHORITY_URL_PATTERN = /^https?:\/\//i;
const UNSAFE_URL_CHARS_REGEX = /[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069\uFFFD]/;

export function sanitizeWebSearchSourceUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > MAX_SOURCE_URL_LENGTH) return null;
  const trimmed = value.trim();
  if (
    !trimmed
    || trimmed.length > MAX_SOURCE_URL_LENGTH
    || !HTTP_AUTHORITY_URL_PATTERN.test(trimmed)
    || UNSAFE_URL_CHARS_REGEX.test(trimmed)
    || trimmed.includes('\\')
  ) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    if (parsed.username || parsed.password || isLocalNetworkHttpUrl(trimmed)) return null;
    return trimmed;
  } catch {
    return null;
  }
}

export function sanitizeWebSearchStatus(value: unknown): WebSearchStatus | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (typeof input.phase !== 'string' || !VALID_PHASES.has(input.phase)) return null;

  const status: WebSearchStatus = { phase: input.phase as WebSearchStatus['phase'] };
  if (typeof input.query === 'string') status.query = input.query.slice(0, 500);
  if (typeof input.message === 'string') status.message = input.message.slice(0, 500);
  if (Array.isArray(input.urls)) {
    status.urls = input.urls
      .map(sanitizeWebSearchSourceUrl)
      .filter((url): url is string => Boolean(url))
      .slice(0, 8);
  }
  if (Array.isArray(input.results)) {
    status.results = input.results.flatMap((result) => {
      if (!result || typeof result !== 'object' || Array.isArray(result)) return [];
      const record = result as Record<string, unknown>;
      const url = sanitizeWebSearchSourceUrl(record.url);
      if (!url) return [];
      return [{
        title: typeof record.title === 'string' ? record.title.slice(0, 300) : url,
        url,
        snippet: typeof record.snippet === 'string' ? record.snippet.slice(0, 500) : '',
        publishedAt: typeof record.publishedAt === 'string' ? record.publishedAt.slice(0, 100) : null,
      }];
    }).slice(0, 5);
  }
  if (Array.isArray(input.failedSources)) {
    status.failedSources = input.failedSources.flatMap((source) => {
      if (!source || typeof source !== 'object' || Array.isArray(source)) return [];
      const record = source as Record<string, unknown>;
      const url = sanitizeWebSearchSourceUrl(record.url);
      if (!url) return [];
      return [{
        url,
        message: typeof record.message === 'string'
          ? record.message.slice(0, 200)
          : 'Unable to read this page.',
      }];
    }).slice(0, 4);
  }
  if (input.metrics && typeof input.metrics === 'object' && !Array.isArray(input.metrics)) {
    const metrics = input.metrics as Record<string, unknown>;
    status.metrics = {};
    for (const key of ['durationMs', 'resultCount', 'successCount', 'failureCount'] as const) {
      if (typeof metrics[key] === 'number' && Number.isFinite(metrics[key])) {
        status.metrics[key] = Math.max(0, Math.round(metrics[key]));
      }
    }
  }
  return status;
}

export function sanitizeWebSearchStatuses(value: unknown): WebSearchStatus[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(sanitizeWebSearchStatus)
    .filter((status): status is WebSearchStatus => Boolean(status))
    .slice(-MAX_STORED_WEB_SEARCH_STATUSES);
}
