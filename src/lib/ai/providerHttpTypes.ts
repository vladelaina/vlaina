export interface ProviderFetchInit {
  method: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: BodyInit | null;
  signal?: AbortSignal;
}
