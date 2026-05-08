export type WebSearchCategory = 'general' | 'news' | 'science' | 'it' | 'images' | 'videos';
export type WebSearchTimeRange = 'day' | 'week' | 'month' | 'year';

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  publishedAt: string | null;
  source: string | null;
  thumbnail: string | null;
}

export interface WebSearchResponse {
  query: string;
  results: WebSearchResult[];
}

export interface WebPageContent {
  title: string;
  summary: string;
  siteName: string;
  finalUrl: string;
  content: string;
  charCount: number;
}

export interface WebPageReadResult {
  url: string;
  ok: boolean;
  page?: WebPageContent;
  error?: string;
  code?: string;
}

export interface WebSearchMetrics {
  durationMs?: number;
  resultCount?: number;
  successCount?: number;
  failureCount?: number;
}

export interface WebSearchFailedSource {
  url: string;
  message: string;
}

export interface WebSearchStatus {
  phase: 'searching' | 'results' | 'reading' | 'complete' | 'error';
  query?: string;
  urls?: string[];
  results?: Array<Pick<WebSearchResult, 'title' | 'url' | 'snippet' | 'publishedAt'>>;
  failedSources?: WebSearchFailedSource[];
  message?: string;
  metrics?: WebSearchMetrics;
}
