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
  throw createAbortError();
}

function createAbortError(): DOMException {
  return new DOMException('The web search request was cancelled.', 'AbortError');
}

function runCancellableDesktopWebSearchRequest<T>(
  signal: AbortSignal | undefined,
  startRequest: (requestId?: string) => Promise<T>,
  cancelRequest: (requestId: string) => Promise<unknown>,
): Promise<T> {
  if (!signal) {
    return startRequest();
  }
  throwIfAborted(signal);

  const requestId = createRequestId();
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    let didStart = false;
    const cleanup = () => {
      signal.removeEventListener('abort', abort);
    };
    const settleRejected = (error: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };
    const abort = () => {
      if (settled) return;
      if (didStart) {
        void cancelRequest(requestId).catch(() => {});
      }
      settleRejected(createAbortError());
    };

    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) {
      abort();
      return;
    }

    try {
      didStart = true;
      startRequest(requestId).then(
        (value) => {
          if (settled) return;
          if (signal.aborted) {
            abort();
            return;
          }
          settled = true;
          cleanup();
          resolve(value);
        },
        settleRejected,
      );
    } catch (error) {
      settleRejected(error);
    }
  });
}

export function createWebSearchClient(): WebSearchClient {
  return {
    async webSearch(query, options, signal) {
      const bridge = getElectronBridge();
      if (!bridge?.webSearch) {
        throw new Error('Web search is temporarily unavailable.');
      }
      return runCancellableDesktopWebSearchRequest(
        signal,
        (requestId) => bridge.webSearch!.search(query, options, requestId),
        (requestId) => bridge.webSearch!.cancelRequest(requestId),
      );
    },
    async readWebPage(url, options, signal) {
      const bridge = getElectronBridge();
      if (!bridge?.webSearch) {
        throw new Error('Web search is temporarily unavailable.');
      }
      return runCancellableDesktopWebSearchRequest(
        signal,
        (requestId) => bridge.webSearch!.read(url, options, requestId),
        (requestId) => bridge.webSearch!.cancelRequest(requestId),
      );
    },
    async readWebPages(urls, options, signal) {
      const bridge = getElectronBridge();
      if (!bridge?.webSearch) {
        throw new Error('Web search is temporarily unavailable.');
      }
      return runCancellableDesktopWebSearchRequest(
        signal,
        (requestId) => bridge.webSearch!.readBatch(urls, options, requestId),
        (requestId) => bridge.webSearch!.cancelRequest(requestId),
      );
    },
  };
}
