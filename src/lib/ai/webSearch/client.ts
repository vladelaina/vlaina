import { getElectronBridge } from '@/lib/electron/bridge';
import type { WebPageContent, WebPageReadResult, WebSearchResponse } from './types';

export interface WebSearchClient {
  webSearch(query: string, options?: {
    category?: string;
    timeRange?: string;
    limit?: number;
  }): Promise<WebSearchResponse>;
  readWebPage(url: string, options?: { contentLimit?: number; retries?: number }): Promise<WebPageContent>;
  readWebPages(urls: string[], options?: { contentLimit?: number; retries?: number }): Promise<WebPageReadResult[]>;
}

export function createWebSearchClient(): WebSearchClient {
  return {
    async webSearch(query, options) {
      const bridge = getElectronBridge();
      if (!bridge?.webSearch) {
        throw new Error('Web search is temporarily unavailable.');
      }
      return bridge.webSearch.search(query, options);
    },
    async readWebPage(url, options) {
      const bridge = getElectronBridge();
      if (!bridge?.webSearch) {
        throw new Error('Web search is temporarily unavailable.');
      }
      return bridge.webSearch.read(url, options);
    },
    async readWebPages(urls, options) {
      const bridge = getElectronBridge();
      if (!bridge?.webSearch) {
        throw new Error('Web search is temporarily unavailable.');
      }
      return bridge.webSearch.readBatch(urls, options);
    },
  };
}
