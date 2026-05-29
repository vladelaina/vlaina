import { createWebSearchClient, type WebSearchClient } from './client';
import {
  formatBatchPagesForModel,
  formatPageForModel,
  formatSafeReadFailure,
  formatSearchResultsForModel,
} from './format';
import { WEB_SEARCH_TOOL_NAMES } from './toolDefinitions';
import type { WebSearchStatus } from './types';

const AUTO_READ_AFTER_SEARCH_LIMIT = 3;
const AUTO_READ_AFTER_SEARCH_CONTENT_LIMIT = 3000;

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
  if (!rawArguments.trim()) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawArguments) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function stringArg(args: Record<string, unknown>, key: string): string {
  const value = args[key];
  return typeof value === 'string' ? value.trim() : '';
}

function stringArrayArg(args: Record<string, unknown>, key: string): string[] {
  const value = args[key];
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
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

function normalizeToolName(name: string): string {
  const normalized = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
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
  return normalized || name;
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
  return error instanceof DOMException && error.name === 'AbortError';
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
      const query = stringArg(args, 'query');
      const startedAt = performance.now();
      options.onStatus?.({ phase: 'searching', query });
      const searchOptions = {
        category: stringArg(args, 'category') || undefined,
        timeRange: stringArg(args, 'timeRange') || undefined,
        limit: 5,
      };
      const response = await callWebSearchClient(
        options.signal,
        (signal) => client.webSearch(query, searchOptions, signal),
        () => client.webSearch(query, searchOptions),
      );
      throwIfAborted(options.signal);
      options.onStatus?.({
        phase: response.results.length > 0 ? 'results' : 'error',
        query: response.query,
        results: response.results.slice(0, 5),
        metrics: {
          durationMs: elapsedSince(startedAt),
          resultCount: response.results.length,
        },
        message: response.results.length > 0 ? undefined : 'No relevant results were found.',
      });
      const searchContent = formatSearchResultsForModel(response);
      if (options.autoReadAfterSearch !== true) {
        return searchContent;
      }

      const urls = response.results
        .map((result) => result.url)
        .filter((url, index, urls): url is string => typeof url === 'string' && url.trim().length > 0 && urls.indexOf(url) === index)
        .slice(0, AUTO_READ_AFTER_SEARCH_LIMIT);

      if (urls.length === 0) {
        return searchContent;
      }

      const readStartedAt = performance.now();
      options.onStatus?.({ phase: 'reading', urls });
      const pages = await callWebSearchClient(
        options.signal,
        (signal) => client.readWebPages(urls, { contentLimit: AUTO_READ_AFTER_SEARCH_CONTENT_LIMIT, retries: 0 }, signal),
        () => client.readWebPages(urls, { contentLimit: AUTO_READ_AFTER_SEARCH_CONTENT_LIMIT, retries: 0 }),
      );
      throwIfAborted(options.signal);
      const successfulPages = pages.filter((page) => page.ok);
      const failedPages = pages.filter((page) => !page.ok);
      options.onStatus?.({
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
      const url = stringArg(args, 'url');
      const startedAt = performance.now();
      options.onStatus?.({ phase: 'reading', urls: [url] });
      const readOptions = { contentLimit: contentLimitArg(args), retries: 0 };
      const page = await callWebSearchClient(
        options.signal,
        (signal) => client.readWebPage(url, readOptions, signal),
        () => client.readWebPage(url, readOptions),
      );
      throwIfAborted(options.signal);
      options.onStatus?.({
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
      const urls = stringArrayArg(args, 'urls').slice(0, 8);
      const startedAt = performance.now();
      options.onStatus?.({ phase: 'reading', urls });
      const readOptions = { contentLimit: contentLimitArg(args), retries: 0 };
      const pages = await callWebSearchClient(
        options.signal,
        (signal) => client.readWebPages(urls, readOptions, signal),
        () => client.readWebPages(urls, readOptions),
      );
      throwIfAborted(options.signal);
      const successfulPages = pages.filter((page) => page.ok);
      const failedPages = pages.filter((page) => !page.ok);
      options.onStatus?.({
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

    return `Unsupported web search tool: ${toolCall.name}`;
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    const message = friendlyToolErrorMessage(toolName, error);
    options.onStatus?.({ phase: 'error', message });
    return `Tool error: ${message}`;
  }
}
