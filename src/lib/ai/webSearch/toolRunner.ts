import { createWebSearchClient, type WebSearchClient } from './client';
import {
  formatBatchPagesForModel,
  formatPageForModel,
  formatSafeReadFailure,
  formatSearchResultsForModel,
} from './format';
import { WEB_SEARCH_TOOL_NAMES } from './toolDefinitions';
import type { WebSearchStatus } from './types';

interface WebSearchToolCall {
  name: string;
  arguments: string;
}

export interface WebSearchToolRunnerOptions {
  client?: WebSearchClient;
  onStatus?: (status: WebSearchStatus) => void;
  signal?: AbortSignal;
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

function normalizeToolName(name: string): string {
  if (name === 'search') return WEB_SEARCH_TOOL_NAMES.search;
  if (name === 'read' || name === 'read_page') return WEB_SEARCH_TOOL_NAMES.read;
  if (name === 'read_pages' || name === 'read_batch') return WEB_SEARCH_TOOL_NAMES.readBatch;
  return name;
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
      return formatSearchResultsForModel(response);
    }

    if (toolName === WEB_SEARCH_TOOL_NAMES.read) {
      const url = stringArg(args, 'url');
      const startedAt = performance.now();
      options.onStatus?.({ phase: 'reading', urls: [url] });
      const readOptions = { contentLimit: 3000, retries: 0 };
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
      const readOptions = { contentLimit: 3000, retries: 0 };
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
