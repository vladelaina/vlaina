import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AIModel, Provider } from '../types';
import { checkModelHealth } from './singleModel';

const provider: Provider = {
  id: 'provider-1',
  name: 'Provider',
  type: 'newapi',
  apiHost: 'https://api.example.com',
  apiKey: 'sk-test',
  enabled: true,
  createdAt: 1,
  updatedAt: 1,
};

function createModel(id: string): AIModel {
  return {
    id,
    name: id,
    providerId: provider.id,
    enabled: true,
    createdAt: 1,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('checkModelHealth', () => {
  it('uses embeddings endpoint for embedding models', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: [{ embedding: [0.1, 0.2] }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const result = await checkModelHealth(provider, createModel('text-embedding-3-large'));
    expect(result.status).toBe('success');
    expect(result.endpoint).toBe('embeddings');

    const [url, requestInit] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/v1/embeddings');
    const body = JSON.parse(String(requestInit.body));
    expect(body.model).toBe('text-embedding-3-large');
    expect(body.input).toBe('hello world');
  });

  it('reports upstream business errors even when HTTP status is 200', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'quota exceeded' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const result = await checkModelHealth(provider, createModel('gpt-4o-mini'));
    expect(result.status).toBe('error');
    expect(result.error).toContain('quota exceeded');
  });

  it('uses responses endpoint for codex-style models', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ output: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const result = await checkModelHealth(provider, createModel('codex-mini-latest'));
    expect(result.status).toBe('success');
    expect(result.endpoint).toBe('responses');

    const [url, requestInit] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/v1/responses');
    const body = JSON.parse(String(requestInit.body));
    expect(body.input).toBe('hi');
  });
});
