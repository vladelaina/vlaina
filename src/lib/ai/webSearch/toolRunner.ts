import { createWebSearchClient, type WebSearchClient } from './client';
import {
  formatBatchPagesForModel,
  formatPageForModel,
  formatSafeReadFailure,
  formatSearchResultsForModel,
} from './format';
import { canParseOpenAIToolArguments } from './openAIToolParsing';
import { sanitizeWebSearchSourceUrl, sanitizeWebSearchStatus } from './statusMarkup';
import { WEB_SEARCH_TOOL_NAMES } from './toolDefinitions';
import type { WebSearchStatus } from './types';

const AUTO_READ_AFTER_SEARCH_LIMIT = 3;
const AUTO_READ_AFTER_SEARCH_CONTENT_LIMIT = 3000;
const MAX_WEB_SEARCH_QUERY_ARG_CHARS = 1000;
const MAX_WEB_SEARCH_URL_ARG_CHARS = 16 * 1024;
const MAX_WEB_SEARCH_OPTION_ARG_CHARS = 64;
const MAX_WEB_SEARCH_BATCH_URLS = 8;
const MAX_WEB_SEARCH_TOOL_NAME_CHARS = 128;

interface WebSearchToolCall {
  name: string;
  arguments: string;
}

export interface WebSearchToolRunnerOptions {
  client?: WebSearchClient;
  onStatus?: (status: WebSearchStatus) => void;
  signal?: AbortSignal;
  autoReadAfterSearch?: boolean;
}

function parseArguments(rawArguments: string): Record<string, unknown> {
  const trimmed = rawArguments.trim();
  if (!trimmed || !canParseOpenAIToolArguments(trimmed)) {
    return {};
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function stringArg(args: Record<string, unknown>, key: string, maxChars: number): string {
  const value = args[key];
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return trimmed.length <= maxChars ? trimmed : '';
}

function stringArrayArg(args: Record<string, unknown>, key: string, maxChars: number, maxItems: number): string[] {
  const value = args[key];
  if (!Array.isArray(value)) {
    return [];
  }
  const result: string[] = [];
  for (const item of value) {
    if (result.length >= maxItems) break;
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (trimmed.length > 0 && trimmed.length <= maxChars) {
      result.push(trimmed);
    }
  }
  return result;
}

function collectUniqueSearchResultUrls(
  results: Array<{ url?: unknown }>,
  limit: number,
): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();
  for (const result of results) {
    if (urls.length >= limit) break;
    const url = sanitizeWebSearchSourceUrl(result.url);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
  }
  return urls;
}

function sanitizeSearchResults<T extends { url?: unknown }>(results: T[], limit: number): Array<T & { url: string }> {
  return results.slice(0, limit).flatMap((result) => {
    const url = sanitizeWebSearchSourceUrl(result.url);
    return url ? [{ ...result, url }] : [];
  });
}

function numberArg(args: Record<string, unknown>, key: string): number | undefined {
  const value = args[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function contentLimitArg(args: Record<string, unknown>): number {
  const limit = numberArg(args, 'contentLimit');
  if (!limit) return 3000;
  return Math.min(3000, Math.max(500, Math.round(limit)));
}

function invalidToolArgumentsResult(
  options: Pick<WebSearchToolRunnerOptions, 'onStatus' | 'signal'>,
): string {
  const message = 'Tool call arguments were invalid.';
  emitStatus(options, { phase: 'error', message });
  return `Tool error: ${message}`;
}

function normalizeToolName(name: string): string {
  const boundedName = name.slice(0, MAX_WEB_SEARCH_TOOL_NAME_CHARS);
  const normalized = boundedName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (
    normalized === WEB_SEARCH_TOOL_NAMES.search ||
    normalized === 'search' ||
    normalized === 'search_web' ||
    normalized === 'searchweb' ||
    normalized === 'web_search_tool' ||
    normalized === 'websearch'
  ) {
    return WEB_SEARCH_TOOL_NAMES.search;
  }
  if (
    normalized === WEB_SEARCH_TOOL_NAMES.read ||
    normalized === 'read' ||
    normalized === 'read_page' ||
    normalized === 'read_webpage' ||
    normalized === 'read_url' ||
    normalized === 'readurl' ||
    normalized === 'fetch_web_page' ||
    normalized === 'fetchwebpage' ||
    normalized === 'fetch_url' ||
    normalized === 'fetchurl'
  ) {
    return WEB_SEARCH_TOOL_NAMES.read;
  }
  if (
    normalized === WEB_SEARCH_TOOL_NAMES.readBatch ||
    normalized === 'read_pages' ||
    normalized === 'read_batch' ||
    normalized === 'read_webpages' ||
    normalized === 'read_urls' ||
    normalized === 'readurls' ||
    normalized === 'fetch_web_pages' ||
    normalized === 'fetchwebpages' ||
    normalized === 'fetch_urls' ||
    normalized === 'fetchurls'
  ) {
    return WEB_SEARCH_TOOL_NAMES.readBatch;
  }
  return normalized || boundedName;
}

function errorCode(error: unknown): string | undefined {
  return error && typeof error === 'object' && typeof (error as { code?: unknown }).code === 'string'
    ? (error as { code: string }).code
    : undefined;
}

function friendlyToolErrorMessage(toolName: string, error?: unknown): string {
  if (toolName === WEB_SEARCH_TOOL_NAMES.search) {
    return 'Web search is temporarily unavailable.';
  }
  if (toolName === WEB_SEARCH_TOOL_NAMES.read || toolName === WEB_SEARCH_TOOL_NAMES.readBatch) {
    return `${formatSafeReadFailure(errorCode(error))} The source was skipped.`;
  }
  return 'Tool call failed.';
}

function elapsedSince(startedAt: number): number {
  return Math.max(0, Math.round(performance.now() - startedAt));
}

function safeFailedSourceMessage(code?: string): string {
  return formatSafeReadFailure(code);
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  throw new DOMException('The web search request was cancelled.', 'AbortError');
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
    || !!error && typeof error === 'object' && (error as { name?: unknown }).name === 'AbortError';
}

function emitStatus(
  options: Pick<WebSearchToolRunnerOptions, 'onStatus' | 'signal'>,
  status: Parameters<NonNullable<WebSearchToolRunnerOptions['onStatus']>>[0],
): void {
  throwIfAborted(options.signal);
  const safeStatus = sanitizeWebSearchStatus(status);
  if (safeStatus) {
    options.onStatus?.(safeStatus);
  }
  throwIfAborted(options.signal);
}

function callWebSearchClient<T>(
  signal: AbortSignal | undefined,
  callWithSignal: (signal: AbortSignal) => Promise<T>,
  callWithoutSignal: () => Promise<T>,
): Promise<T> {
  return signal ? callWithSignal(signal) : callWithoutSignal();
}

export async function runWebSearchToolCall(
  toolCall: WebSearchToolCall,
  options: WebSearchToolRunnerOptions = {},
): Promise<string> {
  const client = options.client ?? createWebSearchClient();
  const args = parseArguments(toolCall.arguments);
  const toolName = normalizeToolName(toolCall.name);

  try {
    throwIfAborted(options.signal);
    if (toolName === WEB_SEARCH_TOOL_NAMES.search) {
      const query = stringArg(args, 'query', MAX_WEB_SEARCH_QUERY_ARG_CHARS);
      if (!query) {
        return invalidToolArgumentsResult(options);
      }
      const startedAt = performance.now();
      emitStatus(options, { phase: 'searching', query });
      const searchOptions = {
        category: stringArg(args, 'category', MAX_WEB_SEARCH_OPTION_ARG_CHARS) || undefined,
        timeRange: stringArg(args, 'timeRange', MAX_WEB_SEARCH_OPTION_ARG_CHARS) || undefined,
        limit: 5,
      };
      const response = await callWebSearchClient(
        options.signal,
        (signal) => client.webSearch(query, searchOptions, signal),
        () => client.webSearch(query, searchOptions),
      );
      throwIfAborted(options.signal);
      const safeResults = sanitizeSearchResults(response.results, 5);
      const safeResponse = { ...response, results: safeResults };
      emitStatus(options, {
        phase: safeResults.length > 0 ? 'results' : 'error',
        query: response.query,
        results: safeResults.slice(0, 5),
        metrics: {
          durationMs: elapsedSince(startedAt),
          resultCount: safeResults.length,
        },
        message: safeResults.length > 0 ? undefined : 'No relevant results were found.',
      });
      const searchContent = formatSearchResultsForModel(safeResponse);
      if (options.autoReadAfterSearch !== true) {
        return searchContent;
      }

      const urls = collectUniqueSearchResultUrls(safeResults, AUTO_READ_AFTER_SEARCH_LIMIT);

      if (urls.length === 0) {
        return searchContent;
      }

      const readStartedAt = performance.now();
      emitStatus(options, { phase: 'reading', urls });
      const pages = await callWebSearchClient(
        options.signal,
        (signal) => client.readWebPages(urls, { contentLimit: AUTO_READ_AFTER_SEARCH_CONTENT_LIMIT, retries: 0 }, signal),
        () => client.readWebPages(urls, { contentLimit: AUTO_READ_AFTER_SEARCH_CONTENT_LIMIT, retries: 0 }),
      );
      throwIfAborted(options.signal);
      const successfulPages = pages.filter((page) => page.ok);
      const failedPages = pages.filter((page) => !page.ok);
      emitStatus(options, {
        phase: 'complete',
        urls: successfulPages.map((page) => page.page?.finalUrl || page.url),
        failedSources: failedPages.map((page) => ({
          url: page.url,
          message: safeFailedSourceMessage(page.code),
        })),
        metrics: {
          durationMs: elapsedSince(readStartedAt),
          failureCount: failedPages.length,
          successCount: successfulPages.length,
        },
      });
      return [
        searchContent,
        '',
        'Automatically read top search results:',
        formatBatchPagesForModel(pages),
      ].join('\n');
    }

    if (toolName === WEB_SEARCH_TOOL_NAMES.read) {
      const url = sanitizeWebSearchSourceUrl(stringArg(args, 'url', MAX_WEB_SEARCH_URL_ARG_CHARS));
      if (!url) {
        return invalidToolArgumentsResult(options);
      }
      const startedAt = performance.now();
      emitStatus(options, { phase: 'reading', urls: [url] });
      const readOptions = { contentLimit: contentLimitArg(args), retries: 0 };
      const page = await callWebSearchClient(
        options.signal,
        (signal) => client.readWebPage(url, readOptions, signal),
        () => client.readWebPage(url, readOptions),
      );
      throwIfAborted(options.signal);
      emitStatus(options, {
        phase: 'complete',
        urls: [page.finalUrl],
        metrics: {
          durationMs: elapsedSince(startedAt),
          failureCount: 0,
          successCount: 1,
        },
      });
      return formatPageForModel(page);
    }

    if (toolName === WEB_SEARCH_TOOL_NAMES.readBatch) {
      const urls = stringArrayArg(args, 'urls', MAX_WEB_SEARCH_URL_ARG_CHARS, MAX_WEB_SEARCH_BATCH_URLS)
        .map(sanitizeWebSearchSourceUrl)
        .filter((url): url is string => Boolean(url));
      if (urls.length === 0) {
        return invalidToolArgumentsResult(options);
      }
      const startedAt = performance.now();
      emitStatus(options, { phase: 'reading', urls });
      const readOptions = { contentLimit: contentLimitArg(args), retries: 0 };
      const pages = await callWebSearchClient(
        options.signal,
        (signal) => client.readWebPages(urls, readOptions, signal),
        () => client.readWebPages(urls, readOptions),
      );
      throwIfAborted(options.signal);
      const successfulPages = pages.filter((page) => page.ok);
      const failedPages = pages.filter((page) => !page.ok);
      emitStatus(options, {
        phase: 'complete',
        urls: successfulPages.map((page) => page.page?.finalUrl || page.url),
        failedSources: failedPages.map((page) => ({
          url: page.url,
          message: safeFailedSourceMessage(page.code),
        })),
        metrics: {
          durationMs: elapsedSince(startedAt),
          failureCount: failedPages.length,
          successCount: successfulPages.length,
        },
      });
      return formatBatchPagesForModel(pages);
    }

    return `Unsupported web search tool: ${toolName}`;
  } catch (error) {
    if (isAbortError(error) && options.signal?.aborted) {
      throw error;
    }
    const message = friendlyToolErrorMessage(toolName, error);
    emitStatus(options, { phase: 'error', message });
    return `Tool error: ${message}`;
  }
}
