import { sanitizeWebSearchSourceUrl } from './statusMarkup';

const MAX_SEARCH_CALLS = 3;
const MAX_READ_CALLS = 6;
const MAX_TOTAL_TOOL_CALLS = 10;
const MAX_ALLOWED_SOURCE_URLS = 20;
const MAX_SEARCH_QUERY_CHARS = 300;
const SECRET_QUERY_PATTERN = /(?:\b(?:bearer|password|passwd|api[_-]?key|access[_-]?token|secret)\s*[:=]\s*\S{8,}|\b(?:sk|pk|ghp|github_pat|xox[baprs]|nts)[_-][A-Za-z0-9_-]{12,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/i;

export class WebSearchPolicyError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'WebSearchPolicyError';
    this.code = code;
  }
}

function normalizeSourceUrl(value: unknown): string {
  const safeUrl = sanitizeWebSearchSourceUrl(value);
  if (!safeUrl) return '';

  const parsed = new URL(safeUrl);
  parsed.hash = '';
  return parsed.toString();
}

export class WebSearchExecutionSession {
  private readonly allowedSourceUrls = new Map<string, string>();
  private searchCalls = 0;
  private readCalls = 0;
  private totalToolCalls = 0;
  private readingStarted = false;

  beginSearch(query: string): void {
    this.beginToolCall();
    if (this.readingStarted) {
      throw new WebSearchPolicyError(
        'search_after_read',
        'New searches are not allowed after page reading has started.',
      );
    }
    if (this.searchCalls >= MAX_SEARCH_CALLS) {
      throw new WebSearchPolicyError('search_budget_exhausted', 'The search request budget was exhausted.');
    }
    if (query.length > MAX_SEARCH_QUERY_CHARS) {
      throw new WebSearchPolicyError('query_too_long', 'The search query is too long.');
    }
    if (SECRET_QUERY_PATTERN.test(query)) {
      throw new WebSearchPolicyError('sensitive_query', 'Sensitive values cannot be sent to web search.');
    }
    this.searchCalls += 1;
  }

  registerSearchResults(results: Array<{ url?: unknown }>): void {
    for (const result of results) {
      if (this.allowedSourceUrls.size >= MAX_ALLOWED_SOURCE_URLS) break;
      const safeUrl = sanitizeWebSearchSourceUrl(result.url);
      const normalizedUrl = normalizeSourceUrl(result.url);
      if (safeUrl && normalizedUrl && !this.allowedSourceUrls.has(normalizedUrl)) {
        this.allowedSourceUrls.set(normalizedUrl, safeUrl);
      }
    }
  }

  authorizeReadUrls(values: unknown[]): string[] {
    this.beginToolCall();
    if (this.readCalls >= MAX_READ_CALLS) {
      throw new WebSearchPolicyError('read_budget_exhausted', 'The page reading budget was exhausted.');
    }

    const urls = values.map((value) => {
      const normalizedUrl = normalizeSourceUrl(value);
      const allowedUrl = normalizedUrl ? this.allowedSourceUrls.get(normalizedUrl) : undefined;
      if (!allowedUrl) {
        throw new WebSearchPolicyError(
          'source_not_allowed',
          'Only URLs returned by the current web search can be read.',
        );
      }
      return allowedUrl;
    });

    if (urls.length === 0) {
      throw new WebSearchPolicyError('source_not_allowed', 'No allowed source URL was provided.');
    }

    this.readCalls += 1;
    this.readingStarted = true;
    return urls;
  }

  private beginToolCall(): void {
    if (this.totalToolCalls >= MAX_TOTAL_TOOL_CALLS) {
      throw new WebSearchPolicyError('tool_budget_exhausted', 'The web search tool budget was exhausted.');
    }
    this.totalToolCalls += 1;
  }
}

export function createWebSearchExecutionSession(): WebSearchExecutionSession {
  return new WebSearchExecutionSession();
}
