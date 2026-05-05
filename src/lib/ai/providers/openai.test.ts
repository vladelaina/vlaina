import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AIModel, Provider } from '../types';
import { getUserFacingAIError } from '../errors';
import { OpenAICompatibleClient } from './openai';

function buildProvider(overrides: Partial<Provider> = {}): Provider {
  return {
    id: 'provider-1',
    name: 'Test',
    type: 'newapi',
    apiHost: 'https://api.example.com',
    apiKey: 'sk-test',
    enabled: true,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function buildModel(overrides: Partial<AIModel> = {}): AIModel {
  return {
    id: 'provider-1::claude-sonnet-4-5',
    apiModelId: 'claude-sonnet-4-5',
    name: 'Claude Sonnet 4.5',
    providerId: 'provider-1',
    enabled: true,
    createdAt: 1,
    ...overrides,
  };
}

function streamResponse(text: string): Response {
  return new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(text));
        controller.close();
      },
    }),
    { status: 200 },
  );
}

describe('OpenAICompatibleClient endpoint detection', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('falls back to Anthropic model listing and returns the detected endpoint type', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('unauthorized', { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: 'claude-sonnet-4-5' }] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await new OpenAICompatibleClient().getModelsWithEndpointDetection(buildProvider());

    expect(result).toEqual({
      models: ['claude-sonnet-4-5'],
      endpointType: 'anthropic',
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://api.example.com/v1/models',
      expect.objectContaining({
        headers: { Authorization: 'Bearer sk-test' },
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://api.example.com/v1/models',
      expect.objectContaining({
        headers: {
          'x-api-key': 'sk-test',
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
      }),
    );
  });

  it('uses a recorded Anthropic endpoint type first', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ data: [{ id: 'claude-opus-4-1' }] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await new OpenAICompatibleClient().getModelsWithEndpointDetection(
      buildProvider({ endpointType: 'anthropic' }),
    );

    expect(result.endpointType).toBe('anthropic');
    expect(result.models).toEqual(['claude-opus-4-1']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/v1/models',
      expect.objectContaining({
        headers: {
          'x-api-key': 'sk-test',
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
      }),
    );
  });

  it('falls back from a recorded Anthropic endpoint type to OpenAI-compatible model listing', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('not found', { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: 'gpt-4o-mini' }] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await new OpenAICompatibleClient().getModelsWithEndpointDetection(
      buildProvider({ endpointType: 'anthropic' }),
    );

    expect(result).toEqual({
      models: ['gpt-4o-mini'],
      endpointType: 'openai',
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://api.example.com/v1/models',
      expect.objectContaining({
        headers: {
          'x-api-key': 'sk-test',
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://api.example.com/v1/models',
      expect.objectContaining({
        headers: { Authorization: 'Bearer sk-test' },
      }),
    );
  });

  it('sends chat requests to Anthropic when the endpoint type is recorded', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      streamResponse('event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"hello"}}\n\n'),
    );
    vi.stubGlobal('fetch', fetchMock);
    const onChunk = vi.fn();

    const result = await new OpenAICompatibleClient().sendMessage(
      'hi',
      [],
      buildModel(),
      buildProvider({ endpointType: 'anthropic' }),
      onChunk,
    );

    expect(result).toBe('hello');
    expect(onChunk).toHaveBeenCalledWith('hello');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/v1/messages',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'x-api-key': 'sk-test',
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
          'Content-Type': 'application/json',
        },
      }),
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      model: 'claude-sonnet-4-5',
      messages: [{ role: 'user', content: 'hi' }],
      stream: true,
    });
  });

  it('wraps Anthropic thinking deltas in think tags', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      streamResponse([
        'event: content_block_delta',
        'data: {"type":"content_block_delta","delta":{"type":"thinking_delta","thinking":"plan"}}',
        '',
        'event: content_block_delta',
        'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"answer"}}',
        '',
      ].join('\n')),
    );
    vi.stubGlobal('fetch', fetchMock);
    const chunks: string[] = [];

    const result = await new OpenAICompatibleClient().sendMessage(
      'hi',
      [],
      buildModel(),
      buildProvider({ endpointType: 'anthropic' }),
      (chunk) => chunks.push(chunk),
    );

    expect(result).toBe('<think>plan</think>answer');
    expect(chunks).toEqual(['<think>plan', '<think>plan</think>answer']);
  });

  it('preserves direct provider transport details for chat failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));

    await expect(
      new OpenAICompatibleClient().sendMessage(
        'hi',
        [],
        buildModel({ apiModelId: 'gpt-4o-mini' }),
        buildProvider(),
        vi.fn(),
      ),
    ).rejects.toMatchObject({
      details: 'OpenAI-compatible chat request to https://api.example.com/v1/chat/completions failed: fetch failed',
    });

    try {
      await new OpenAICompatibleClient().sendMessage(
        'hi',
        [],
        buildModel({ apiModelId: 'gpt-4o-mini' }),
        buildProvider(),
        vi.fn(),
      );
    } catch (error) {
      expect(getUserFacingAIError(error).message).toBe(
        'OpenAI-compatible chat request to https://api.example.com/v1/chat/completions failed: fetch failed',
      );
    }
  });
});
