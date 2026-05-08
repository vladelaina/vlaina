import type { WebPageContent, WebPageReadResult, WebSearchResponse } from './types';

const SEARCH_RESULT_LIMIT = 5;
const PAGE_CONTENT_LIMIT = 3000;

function clip(value: string, limit: number): string {
  return value.length > limit ? `${value.slice(0, limit)}\n[truncated]` : value;
}

export function formatSearchResultsForModel(response: WebSearchResponse): string {
  if (response.results.length === 0) {
    return `No search results found for: ${response.query}`;
  }

  const lines = [
    `Search query: ${response.query}`,
    'Candidate sources:',
  ];

  response.results.slice(0, SEARCH_RESULT_LIMIT).forEach((result, index) => {
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
  return [
    `Title: ${page.title}`,
    `URL: ${page.finalUrl}`,
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
        return [
          `Page ${index + 1}: failed`,
          `URL: ${result.url}`,
          'Error: Unable to read this page.',
        ].join('\n');
      }

      return [`Page ${index + 1}: success`, formatPageForModel(result.page)].join('\n');
    })
    .join('\n\n---\n\n');
}
