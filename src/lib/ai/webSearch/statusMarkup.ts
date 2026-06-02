import type { WebSearchStatus } from './types';
import { isLocalNetworkHttpUrl } from '@/lib/notes/markdown/urlSecurity';

const WEB_SEARCH_STATUS_REGEX = /<web-search-status>([\s\S]*?)<\/web-search-status>/gi;
const VALID_PHASES = new Set(['searching', 'results', 'reading', 'complete', 'error']);
const MAX_STATUS_JSON_LENGTH = 20000;
const UNSAFE_URL_CHARS_REGEX = /[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069\uFFFD]/;

export function sanitizeWebSearchSourceUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || UNSAFE_URL_CHARS_REGEX.test(trimmed)) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    if (isLocalNetworkHttpUrl(trimmed)) return null;
    return trimmed;
  } catch {
    return null;
  }
}

function sanitizeStatus(value: unknown): WebSearchStatus | null {
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
    status.results = input.results
      .map((result) => {
        if (!result || typeof result !== 'object' || Array.isArray(result)) return null;
        const url = sanitizeWebSearchSourceUrl((result as Record<string, unknown>).url);
        return url ? { result: result as Record<string, unknown>, url } : null;
      })
      .filter((entry): entry is { result: Record<string, unknown>; url: string } => Boolean(entry))
      .slice(0, 5)
      .map(({ result, url }) => {
        return {
          title: typeof result.title === 'string' ? result.title.slice(0, 300) : url,
          url,
          snippet: typeof result.snippet === 'string' ? result.snippet.slice(0, 1000) : '',
          publishedAt: typeof result.publishedAt === 'string' ? result.publishedAt.slice(0, 100) : null,
        };
      });
  }
  if (Array.isArray(input.failedSources)) {
    status.failedSources = input.failedSources
      .map((source) => {
        if (!source || typeof source !== 'object' || Array.isArray(source)) return null;
        const url = sanitizeWebSearchSourceUrl((source as Record<string, unknown>).url);
        return url ? { source: source as Record<string, unknown>, url } : null;
      })
      .filter((entry): entry is { source: Record<string, unknown>; url: string } => Boolean(entry))
      .slice(0, 4)
      .map(({ source, url }) => ({
        url,
        message: typeof source.message === 'string' ? source.message.slice(0, 200) : 'Unable to read this page.',
      }));
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

function escapeStatusJson(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function unescapeStatusJson(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

export function buildWebSearchStatusMarkup(status: WebSearchStatus): string {
  return `<web-search-status>${escapeStatusJson(JSON.stringify(status))}</web-search-status>`;
}

export function stripWebSearchStatusMarkup(content: string): string {
  return content.replace(WEB_SEARCH_STATUS_REGEX, '').trimStart();
}

export function extractWebSearchStatuses(content: string): {
  statuses: WebSearchStatus[];
  content: string;
} {
  const statuses: WebSearchStatus[] = [];
  const nextContent = content.replace(WEB_SEARCH_STATUS_REGEX, (_match, json) => {
    try {
      if (String(json).length > MAX_STATUS_JSON_LENGTH) return '';
      const parsed = JSON.parse(unescapeStatusJson(json)) as WebSearchStatus;
      const status = sanitizeStatus(parsed);
      if (status) statuses.push(status);
    } catch {
      // Ignore malformed status payloads; the assistant text should still render.
    }
    return '';
  });

  return {
    statuses,
    content: nextContent.trimStart(),
  };
}
