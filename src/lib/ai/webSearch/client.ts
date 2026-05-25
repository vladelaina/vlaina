import { getElectronBridge } from '@/lib/electron/bridge';
import type { WebPageContent, WebPageReadResult, WebSearchResponse } from './types';

export interface WebSearchClient {
  webSearch(query: string, options?: {
    category?: string;
    timeRange?: string;
    limit?: number;
  }, signal?: AbortSignal): Promise<WebSearchResponse>;
  readWebPage(url: string, options?: { contentLimit?: number; retries?: number }, signal?: AbortSignal): Promise<WebPageContent>;
  readWebPages(urls: string[], options?: { contentLimit?: number; retries?: number }, signal?: AbortSignal): Promise<WebPageReadResult[]>;
}

let nextRequestId = 0;

function createRequestId(): string {
  nextRequestId += 1;
  return `web-search-${Date.now()}-${nextRequestId}`;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  throw new DOMException('The web search request was cancelled.', 'AbortError');
}

function withAbort<T>(
  promise: Promise<T>,
  signal: AbortSignal | undefined,
  cancelRequest: (() => void) | undefined,
): Promise<T> {
  if (!signal) return promise;
  throwIfAborted(signal);
  return new Promise<T>((resolve, reject) => {
    const abort = () => {
      cancelRequest?.();
      reject(new DOMException('The web search request was cancelled.', 'AbortError'));
    };
    signal.addEventListener('abort', abort, { once: true });
    promise.then(resolve, reject).finally(() => {
      signal.removeEventListener('abort', abort);
    });
  });
}

export function createWebSearchClient(): WebSearchClient {
  return {
    async webSearch(query, options, signal) {
      const bridge = getElectronBridge();
      if (!bridge?.webSearch) {
        throw new Error('Web search is temporarily unavailable.');
      }
      throwIfAborted(signal);
      const requestId = signal ? createRequestId() : undefined;
      const promise = bridge.webSearch.search(query, options, requestId);
      return withAbort(promise, signal, requestId ? () => {
        void bridge.webSearch?.cancelRequest(requestId).catch(() => {});
      } : undefined);
    },
    async readWebPage(url, options, signal) {
      const bridge = getElectronBridge();
      if (!bridge?.webSearch) {
        throw new Error('Web search is temporarily unavailable.');
      }
      throwIfAborted(signal);
      const requestId = signal ? createRequestId() : undefined;
      const promise = bridge.webSearch.read(url, options, requestId);
      return withAbort(promise, signal, requestId ? () => {
        void bridge.webSearch?.cancelRequest(requestId).catch(() => {});
      } : undefined);
    },
    async readWebPages(urls, options, signal) {
      const bridge = getElectronBridge();
      if (!bridge?.webSearch) {
        throw new Error('Web search is temporarily unavailable.');
      }
      throwIfAborted(signal);
      const requestId = signal ? createRequestId() : undefined;
      const promise = bridge.webSearch.readBatch(urls, options, requestId);
      return withAbort(promise, signal, requestId ? () => {
        void bridge.webSearch?.cancelRequest(requestId).catch(() => {});
      } : undefined);
    },
  };
}
