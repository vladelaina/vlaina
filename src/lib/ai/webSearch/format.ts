import type { WebPageContent, WebPageReadResult, WebSearchResponse } from './types';
import { sanitizeWebSearchSourceUrl } from './statusMarkup';

const SEARCH_RESULT_LIMIT = 5;
const PAGE_CONTENT_LIMIT = 3000;
const QUERY_LIMIT = 500;
const TITLE_LIMIT = 300;
const SUMMARY_LIMIT = 1000;
const SITE_NAME_LIMIT = 200;
const TIMESTAMP_LIMIT = 100;
const SOURCE_LIMIT = 200;

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
    return `No search results found for: ${clip(response.query, QUERY_LIMIT)}`;
  }

  const lines = [
    `Search query: ${clip(response.query, QUERY_LIMIT)}`,
    'Candidate sources:',
  ];

  safeResults.forEach((result, index) => {
    lines.push(
      `${index + 1}. ${clip(result.title, TITLE_LIMIT)}`,
      `URL: ${result.url}`,
      `Summary: ${result.snippet ? clip(result.snippet, SUMMARY_LIMIT) : '(none)'}`,
      `Time: ${result.publishedAt ? clip(result.publishedAt, TIMESTAMP_LIMIT) : '(unknown)'}`,
      `Source: ${result.source ? clip(result.source, SOURCE_LIMIT) : '(unknown)'}`,
    );
  });

  return lines.join('\n');
}

export function formatPageForModel(page: WebPageContent): string {
  const safeFinalUrl = sanitizeWebSearchSourceUrl(page.finalUrl) ?? '(unavailable)';
  return [
    `Title: ${clip(page.title, TITLE_LIMIT)}`,
    `URL: ${safeFinalUrl}`,
    `Site: ${page.siteName ? clip(page.siteName, SITE_NAME_LIMIT) : '(unknown)'}`,
    `Summary: ${page.summary ? clip(page.summary, SUMMARY_LIMIT) : '(none)'}`,
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
