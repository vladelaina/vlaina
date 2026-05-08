import type { WebSearchStatus } from './types';

const WEB_SEARCH_STATUS_REGEX = /<web-search-status>([\s\S]*?)<\/web-search-status>/gi;
const VALID_PHASES = new Set(['searching', 'results', 'reading', 'complete', 'error']);
const MAX_STATUS_JSON_LENGTH = 20000;

function isSafeHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
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
    status.urls = input.urls.filter(isSafeHttpUrl).slice(0, 8);
  }
  if (Array.isArray(input.results)) {
    status.results = input.results
      .filter((result): result is Record<string, unknown> =>
        Boolean(result) && typeof result === 'object' && !Array.isArray(result) && isSafeHttpUrl(result.url))
      .slice(0, 5)
      .map((result) => {
        const url = String(result.url);
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
      .filter((source): source is Record<string, unknown> =>
        Boolean(source) && typeof source === 'object' && !Array.isArray(source) && isSafeHttpUrl(source.url))
      .slice(0, 4)
      .map((source) => ({
        url: String(source.url),
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
