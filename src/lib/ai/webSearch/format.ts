import type { WebPageContent, WebPageReadResult, WebSearchResponse } from './types';
import { sanitizeWebSearchSourceUrl } from './statusMarkup';

const SEARCH_RESULT_LIMIT = 5;
const PAGE_CONTENT_LIMIT = 3000;

function clip(value: string, limit: number): string {
  return value.length > limit ? `${value.slice(0, limit)}\n[truncated]` : value;
}

export function formatSafeReadFailure(code?: string): string {
  if (code === 'blocked_source') {
    return 'This source is blocked by the web search source policy.';
  }
  if (code === 'blocked_page') {
    return 'The page blocked automated reading.';
  }
  if (code === 'content_too_short') {
    return 'The page did not expose enough readable content.';
  }
  if (code === 'timeout') {
    return 'The page request timed out.';
  }
  if (code === 'network_error') {
    return 'The page could not be reached.';
  }
  if (code === 'http_error') {
    return 'The page returned an HTTP error.';
  }
  return 'Unable to read this page.';
}

export function formatSearchResultsForModel(response: WebSearchResponse): string {
  const safeResults = response.results
    .slice(0, SEARCH_RESULT_LIMIT)
    .flatMap((result) => {
      const url = sanitizeWebSearchSourceUrl(result.url);
      return url ? [{ ...result, url }] : [];
    });
  if (safeResults.length === 0) {
    return `No search results found for: ${response.query}`;
  }

  const lines = [
    `Search query: ${response.query}`,
    'Candidate sources:',
  ];

  safeResults.forEach((result, index) => {
    lines.push(
      `${index + 1}. ${result.title}`,
      `URL: ${result.url}`,
      `Summary: ${result.snippet || '(none)'}`,
      `Time: ${result.publishedAt || '(unknown)'}`,
      `Source: ${result.source || '(unknown)'}`,
    );
  });

  return lines.join('\n');
}

export function formatPageForModel(page: WebPageContent): string {
  const safeFinalUrl = sanitizeWebSearchSourceUrl(page.finalUrl) ?? '(unavailable)';
  return [
    `Title: ${page.title}`,
    `URL: ${safeFinalUrl}`,
    `Site: ${page.siteName || '(unknown)'}`,
    `Summary: ${page.summary || '(none)'}`,
    `Characters: ${page.charCount}`,
    'Content:',
    clip(page.content, PAGE_CONTENT_LIMIT),
  ].join('\n');
}

export function formatBatchPagesForModel(results: WebPageReadResult[]): string {
  return results
    .map((result, index) => {
      if (!result.ok || !result.page) {
        const safeUrl = sanitizeWebSearchSourceUrl(result.url) ?? '(unavailable)';
        return [
          `Page ${index + 1}: failed`,
          `URL: ${safeUrl}`,
          `Error: ${formatSafeReadFailure(result.code)}`,
        ].join('\n');
      }

      return [`Page ${index + 1}: success`, formatPageForModel(result.page)].join('\n');
    })
    .join('\n\n---\n\n');
}
