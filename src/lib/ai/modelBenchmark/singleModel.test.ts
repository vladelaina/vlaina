import { afterEach, describe, expect, it, vi } from 'vitest';
import { MAX_PROVIDER_ERROR_BODY_BYTES } from '../providers/boundedResponseText';
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
    apiModelId: id,
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

  it('reports embedded xml errors returned inside chat success payloads', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content:
                  '<error type="SERVER_ERROR" code="503">No available channel for model grok-4.1 under group default</error>',
              },
            },
          ],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );

    const result = await checkModelHealth(provider, createModel('grok-4.1'));
    expect(result.status).toBe('error');
    expect(result.error).toContain('No available channel for model grok-4.1 under group default');
  });

  it('treats plain-text 200 responses as errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('No available channel for model grok-4.1 under group default', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      })
    );

    const result = await checkModelHealth(provider, createModel('grok-4.1'));
    expect(result.status).toBe('error');
    expect(result.error).toContain('No available channel for model grok-4.1 under group default');
  });

  it('treats unexpected 200 payloads as errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const result = await checkModelHealth(provider, createModel('gpt-4o-mini'));
    expect(result.status).toBe('error');
    expect(result.error).toContain('Unexpected benchmark response');
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

  it('uses Anthropic messages endpoint when the provider endpoint type is Anthropic', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ content: [{ type: 'text', text: 'ok' }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const result = await checkModelHealth(
      { ...provider, endpointType: 'anthropic' },
      createModel('claude-sonnet-4-5')
    );
    expect(result.status).toBe('success');
    expect(result.endpoint).toBe('chat');

    const [url, requestInit] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/v1/messages');
    expect(requestInit.headers).toEqual({
      'x-api-key': 'sk-test',
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      'Content-Type': 'application/json',
    });
    const body = JSON.parse(String(requestInit.body));
    expect(body).toMatchObject({
      model: 'claude-sonnet-4-5',
      messages: [{ role: 'user', content: 'hi' }],
      max_tokens: 16,
    });
  });

  it('does not classify downstream abort-shaped failures as user-aborted benchmark requests', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue({ name: 'AbortError', message: 'Aborted' });

    const result = await checkModelHealth(provider, createModel('gpt-4o-mini'));

    expect(result).toMatchObject({
      status: 'error',
      error: 'Aborted',
      endpoint: 'chat',
    });
  });

  it('classifies external abort signals as aborted benchmark requests', async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const result = await checkModelHealth(provider, createModel('gpt-4o-mini'), {
      signal: controller.signal,
    });

    expect(result).toMatchObject({
      status: 'error',
      error: 'Request aborted',
      endpoint: 'chat',
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('classifies external aborts during response body parsing as aborted benchmark requests', async () => {
    const controller = new AbortController();
    const reader = {
      read: vi.fn(async () => {
        controller.abort();
        return {
          done: false,
          value: new TextEncoder().encode(JSON.stringify({ choices: [{ message: { content: 'ok' } }] })),
        };
      }),
      cancel: vi.fn(async () => undefined),
      releaseLock: vi.fn(),
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      body: {
        getReader: () => reader,
      },
    } as unknown as Response);

    const result = await checkModelHealth(provider, createModel('gpt-4o-mini'), {
      signal: controller.signal,
    });

    expect(result).toMatchObject({
      status: 'error',
      error: 'Request aborted',
      endpoint: 'chat',
    });
    expect(reader.cancel).toHaveBeenCalledTimes(1);
    expect(reader.releaseLock).toHaveBeenCalledTimes(1);
  });

  it('classifies timeouts during response body parsing as benchmark timeouts', async () => {
    vi.useFakeTimers();
    try {
      const reader = {
        read: vi.fn(() => new Promise<ReadableStreamReadResult<Uint8Array>>(() => undefined)),
        cancel: vi.fn(async () => undefined),
        releaseLock: vi.fn(),
      };
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        body: {
          getReader: () => reader,
        },
      } as unknown as Response);

      const pending = checkModelHealth(provider, createModel('gpt-4o-mini'), {
        timeoutMs: 1000,
      });
      await vi.advanceTimersByTimeAsync(0);
      expect(reader.read).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1000);

      await expect(pending).resolves.toMatchObject({
        status: 'error',
        error: 'Request timed out (1s)',
        endpoint: 'chat',
      });
      expect(reader.cancel).toHaveBeenCalledTimes(1);
      expect(reader.releaseLock).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('bounds oversized benchmark response bodies', async () => {
    const cancel = vi.fn();
    const response = new Response(
      new ReadableStream({
        start(streamController) {
          streamController.enqueue(new TextEncoder().encode('x'.repeat(MAX_PROVIDER_ERROR_BODY_BYTES + 1)));
        },
        cancel,
      }),
      { status: 200 }
    );
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(response);

    const result = await checkModelHealth(provider, createModel('gpt-4o-mini'));

    expect(result).toMatchObject({
      status: 'error',
      error: 'Unknown error',
      endpoint: 'chat',
    });
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(() => response.body?.getReader()).not.toThrow();
  });
});
