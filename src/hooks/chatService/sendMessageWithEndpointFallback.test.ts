import { describe, expect, it, vi } from 'vitest';
import { AIErrorType, type AIModel, type Provider } from '@/lib/ai/types';
import { sendMessageWithEndpointFallback } from './sendMessageWithEndpointFallback';

function buildProvider(overrides: Partial<Provider> = {}): Provider {
  return {
    id: 'provider-1',
    name: 'QnAIGC Anthropic',
    type: 'newapi',
    apiHost: 'https://anthropic.qnaigc.com',
    apiKey: 'sk-test',
    enabled: true,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function buildModel(): AIModel {
  return {
    id: 'provider-1::claude-sonnet-4-5',
    apiModelId: 'claude-sonnet-4-5',
    name: 'Claude Sonnet 4.5',
    providerId: 'provider-1',
    enabled: true,
    createdAt: 1,
  };
}

describe('sendMessageWithEndpointFallback', () => {
  it('uses the recorded OpenAI endpoint type without trying fallback again', async () => {
    const updateProvider = vi.fn();
    const onChunk = vi.fn();
    const client = {
      sendMessage: vi.fn().mockResolvedValue('openai ok'),
    };

    const result = await sendMessageWithEndpointFallback({
      content: 'hi',
      history: [],
      model: buildModel(),
      provider: buildProvider({ endpointType: 'openai', endpointTypeCheckedAt: 1 }),
      onChunk,
      client,
      updateProvider,
    });

    expect(result).toBe('openai ok');
    expect(client.sendMessage).toHaveBeenCalledTimes(1);
    expect(client.sendMessage.mock.calls[0][3]).toMatchObject({ endpointType: 'openai' });
    expect(updateProvider).not.toHaveBeenCalled();
  });

  it('retries a verified endpoint once when a transient error happens before streaming output', async () => {
    const updateProvider = vi.fn();
    const onChunk = vi.fn();
    const client = {
      sendMessage: vi
        .fn()
        .mockRejectedValueOnce({
          type: AIErrorType.SERVER_ERROR,
          message: 'Service unavailable',
          statusCode: 503,
        })
        .mockResolvedValueOnce('retry ok'),
    };

    const result = await sendMessageWithEndpointFallback({
      content: 'hi',
      history: [],
      model: buildModel(),
      provider: buildProvider({ endpointType: 'openai', endpointTypeCheckedAt: 1 }),
      onChunk,
      client,
      updateProvider,
      retryDelayMs: 0,
    });

    expect(result).toBe('retry ok');
    expect(client.sendMessage).toHaveBeenCalledTimes(2);
    expect(updateProvider).not.toHaveBeenCalled();
  });

  it('retries abort-shaped pre-stream failures when the chat signal is still active', async () => {
    const updateProvider = vi.fn();
    const onChunk = vi.fn();
    const client = {
      sendMessage: vi
        .fn()
        .mockRejectedValueOnce(new DOMException('provider reset', 'AbortError'))
        .mockResolvedValueOnce('retry ok'),
    };

    const result = await sendMessageWithEndpointFallback({
      content: 'hi',
      history: [],
      model: buildModel(),
      provider: buildProvider({ endpointType: 'openai', endpointTypeCheckedAt: 1 }),
      onChunk,
      client,
      updateProvider,
      retryDelayMs: 0,
    });

    expect(result).toBe('retry ok');
    expect(client.sendMessage).toHaveBeenCalledTimes(2);
    expect(updateProvider).not.toHaveBeenCalled();
  });

  it('does not call the provider when the chat signal is already aborted', async () => {
    const updateProvider = vi.fn();
    const controller = new AbortController();
    controller.abort();
    const client = {
      sendMessage: vi.fn(),
    };

    await expect(
      sendMessageWithEndpointFallback({
        content: 'hi',
        history: [],
        model: buildModel(),
        provider: buildProvider(),
        onChunk: vi.fn(),
        client,
        updateProvider,
        retryDelayMs: 0,
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });

    expect(client.sendMessage).not.toHaveBeenCalled();
    expect(updateProvider).not.toHaveBeenCalled();
  });

  it('does not retry or fall back after the chat signal aborts during a pre-stream error', async () => {
    const updateProvider = vi.fn();
    const controller = new AbortController();
    const client = {
      sendMessage: vi.fn().mockImplementationOnce(() => {
        controller.abort();
        return Promise.reject({
          type: AIErrorType.SERVER_ERROR,
          message: 'Service unavailable',
          statusCode: 503,
        });
      }),
    };

    await expect(
      sendMessageWithEndpointFallback({
        content: 'hi',
        history: [],
        model: buildModel(),
        provider: buildProvider(),
        onChunk: vi.fn(),
        client,
        updateProvider,
        retryDelayMs: 0,
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });

    expect(client.sendMessage).toHaveBeenCalledTimes(1);
    expect(client.sendMessage.mock.calls[0][3]).toMatchObject({ endpointType: 'openai' });
    expect(updateProvider).not.toHaveBeenCalled();
  });

  it('does not retry a verified endpoint after streaming output has started', async () => {
    const updateProvider = vi.fn();
    const onChunk = vi.fn();
    const client = {
      sendMessage: vi.fn(async (_content, _history, _model, _provider, chunk) => {
        chunk?.('partial');
        throw {
          type: AIErrorType.SERVER_ERROR,
          message: 'Service unavailable',
          statusCode: 503,
        };
      }),
    };

    await expect(
      sendMessageWithEndpointFallback({
        content: 'hi',
        history: [],
        model: buildModel(),
        provider: buildProvider({ endpointType: 'openai', endpointTypeCheckedAt: 1 }),
        onChunk,
        client,
        updateProvider,
        retryDelayMs: 0,
      }),
    ).rejects.toMatchObject({ statusCode: 503 });

    expect(onChunk).toHaveBeenCalledWith('partial');
    expect(client.sendMessage).toHaveBeenCalledTimes(1);
    expect(updateProvider).not.toHaveBeenCalled();
  });

  it('does not retry rate limit or quota-shaped failures', async () => {
    const updateProvider = vi.fn();
    const client = {
      sendMessage: vi.fn().mockRejectedValue({
        type: AIErrorType.RATE_LIMIT,
        message: 'Too many requests',
        statusCode: 429,
      }),
    };

    await expect(
      sendMessageWithEndpointFallback({
        content: 'hi',
        history: [],
        model: buildModel(),
        provider: buildProvider({ endpointType: 'openai', endpointTypeCheckedAt: 1 }),
        onChunk: vi.fn(),
        client,
        updateProvider,
        retryDelayMs: 0,
      }),
    ).rejects.toMatchObject({ statusCode: 429 });

    expect(client.sendMessage).toHaveBeenCalledTimes(1);
  });

  it('rechecks OpenAI before using an unverified recorded Anthropic endpoint type', async () => {
    const updateProvider = vi.fn();
    const onChunk = vi.fn();
    const client = {
      sendMessage: vi.fn().mockResolvedValue('openai ok'),
    };

    const result = await sendMessageWithEndpointFallback({
      content: 'hi',
      history: [],
      model: buildModel(),
      provider: buildProvider({ endpointType: 'anthropic' }),
      onChunk,
      client,
      updateProvider,
    });

    expect(result).toBe('openai ok');
    expect(client.sendMessage).toHaveBeenCalledTimes(1);
    expect(client.sendMessage.mock.calls[0][3]).toMatchObject({ endpointType: 'openai' });
    expect(updateProvider).toHaveBeenCalledWith('provider-1', {
      endpointType: 'openai',
      endpointTypeCheckedAt: expect.any(Number),
    });
  });

  it('uses a verified recorded Anthropic endpoint type without trying OpenAI again', async () => {
    const updateProvider = vi.fn();
    const onChunk = vi.fn();
    const client = {
      sendMessage: vi.fn().mockResolvedValue('anthropic ok'),
    };

    const result = await sendMessageWithEndpointFallback({
      content: 'hi',
      history: [],
      model: buildModel(),
      provider: buildProvider({ endpointType: 'anthropic', endpointTypeCheckedAt: 1 }),
      onChunk,
      client,
      updateProvider,
    });

    expect(result).toBe('anthropic ok');
    expect(client.sendMessage).toHaveBeenCalledTimes(1);
    expect(client.sendMessage.mock.calls[0][3]).toMatchObject({ endpointType: 'anthropic' });
    expect(updateProvider).not.toHaveBeenCalled();
  });

  it('tries Anthropic and records it when the first OpenAI-compatible chat fails before streaming output', async () => {
    const updateProvider = vi.fn();
    const onChunk = vi.fn();
    const client = {
      sendMessage: vi
        .fn()
        .mockRejectedValueOnce(new Error('OpenAI-compatible chat failed'))
        .mockResolvedValueOnce('anthropic ok'),
    };

    const result = await sendMessageWithEndpointFallback({
      content: 'hi',
      history: [],
      model: buildModel(),
      provider: buildProvider(),
      onChunk,
      client,
      updateProvider,
    });

    expect(result).toBe('anthropic ok');
    expect(client.sendMessage).toHaveBeenCalledTimes(2);
    expect(client.sendMessage.mock.calls[0][3]).toMatchObject({ endpointType: 'openai' });
    expect(client.sendMessage.mock.calls[1][3]).toMatchObject({ endpointType: 'anthropic' });
    expect(updateProvider).toHaveBeenCalledWith('provider-1', {
      endpointType: 'anthropic',
      endpointTypeCheckedAt: expect.any(Number),
    });
  });

  it('falls back to Anthropic after repeated abort-shaped OpenAI pre-stream failures when still active', async () => {
    const updateProvider = vi.fn();
    const client = {
      sendMessage: vi
        .fn()
        .mockRejectedValueOnce(new DOMException('openai stream reset', 'AbortError'))
        .mockRejectedValueOnce(new DOMException('openai stream reset', 'AbortError'))
        .mockResolvedValueOnce('anthropic ok'),
    };

    const result = await sendMessageWithEndpointFallback({
      content: 'hi',
      history: [],
      model: buildModel(),
      provider: buildProvider(),
      onChunk: vi.fn(),
      client,
      updateProvider,
      retryDelayMs: 0,
    });

    expect(result).toBe('anthropic ok');
    expect(client.sendMessage).toHaveBeenCalledTimes(3);
    expect(client.sendMessage.mock.calls[0][3]).toMatchObject({ endpointType: 'openai' });
    expect(client.sendMessage.mock.calls[1][3]).toMatchObject({ endpointType: 'openai' });
    expect(client.sendMessage.mock.calls[2][3]).toMatchObject({ endpointType: 'anthropic' });
    expect(updateProvider).toHaveBeenCalledWith('provider-1', {
      endpointType: 'anthropic',
      endpointTypeCheckedAt: expect.any(Number),
    });
  });

  it('does not fall back to a non-tool endpoint when web search is enabled', async () => {
    const updateProvider = vi.fn();
    const openAIError = new Error('OpenAI-compatible chat failed');
    const client = {
      sendMessage: vi.fn().mockRejectedValue(openAIError),
    };

    await expect(
      sendMessageWithEndpointFallback({
        content: 'hi',
        history: [],
        model: buildModel(),
        provider: buildProvider(),
        onChunk: vi.fn(),
        client,
        updateProvider,
        options: { webSearchEnabled: true },
      }),
    ).rejects.toBe(openAIError);

    expect(client.sendMessage).toHaveBeenCalledTimes(1);
    expect(client.sendMessage.mock.calls[0][3]).toMatchObject({ endpointType: 'openai' });
    expect(updateProvider).not.toHaveBeenCalled();
  });

  it('does not auto-retry web search requests', async () => {
    const updateProvider = vi.fn();
    const transientError = {
      type: AIErrorType.SERVER_ERROR,
      message: 'Service unavailable',
      statusCode: 503,
    };
    const client = {
      sendMessage: vi.fn().mockRejectedValue(transientError),
    };

    await expect(
      sendMessageWithEndpointFallback({
        content: 'hi',
        history: [],
        model: buildModel(),
        provider: buildProvider({ endpointType: 'openai', endpointTypeCheckedAt: 1 }),
        onChunk: vi.fn(),
        client,
        updateProvider,
        options: { webSearchEnabled: true },
        retryDelayMs: 0,
      }),
    ).rejects.toBe(transientError);

    expect(client.sendMessage).toHaveBeenCalledTimes(1);
  });

  it('does not try Anthropic after OpenAI has already streamed output', async () => {
    const updateProvider = vi.fn();
    const client = {
      sendMessage: vi.fn(async (_content, _history, _model, _provider, onChunk) => {
        onChunk?.('partial');
        throw new Error('stream interrupted');
      }),
    };

    await expect(
      sendMessageWithEndpointFallback({
        content: 'hi',
        history: [],
        model: buildModel(),
        provider: buildProvider(),
        onChunk: vi.fn(),
        client,
        updateProvider,
      }),
    ).rejects.toThrow('stream interrupted');

    expect(client.sendMessage).toHaveBeenCalledTimes(1);
    expect(updateProvider).not.toHaveBeenCalled();
  });

  it('does not record OpenAI endpoint type when the request resolves after cancellation', async () => {
    const updateProvider = vi.fn();
    const controller = new AbortController();
    const client = {
      sendMessage: vi.fn().mockImplementationOnce(() => {
        controller.abort();
        return Promise.resolve('late openai ok');
      }),
    };

    await expect(
      sendMessageWithEndpointFallback({
        content: 'hi',
        history: [],
        model: buildModel(),
        provider: buildProvider(),
        onChunk: vi.fn(),
        client,
        updateProvider,
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });

    expect(client.sendMessage).toHaveBeenCalledTimes(1);
    expect(client.sendMessage.mock.calls[0][3]).toMatchObject({ endpointType: 'openai' });
    expect(updateProvider).not.toHaveBeenCalled();
  });

  it('does not record Anthropic endpoint type when fallback resolves after cancellation', async () => {
    const updateProvider = vi.fn();
    const controller = new AbortController();
    const client = {
      sendMessage: vi
        .fn()
        .mockRejectedValueOnce(new Error('OpenAI-compatible chat failed'))
        .mockImplementationOnce(() => {
          controller.abort();
          return Promise.resolve('late anthropic ok');
        }),
    };

    await expect(
      sendMessageWithEndpointFallback({
        content: 'hi',
        history: [],
        model: buildModel(),
        provider: buildProvider(),
        onChunk: vi.fn(),
        client,
        updateProvider,
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });

    expect(client.sendMessage).toHaveBeenCalledTimes(2);
    expect(client.sendMessage.mock.calls[0][3]).toMatchObject({ endpointType: 'openai' });
    expect(client.sendMessage.mock.calls[1][3]).toMatchObject({ endpointType: 'anthropic' });
    expect(updateProvider).not.toHaveBeenCalled();
  });

  it('does not forward chunks that arrive after cancellation', async () => {
    const updateProvider = vi.fn();
    const controller = new AbortController();
    const onChunk = vi.fn();
    const client = {
      sendMessage: vi.fn(async (_content, _history, _model, _provider, chunk) => {
        controller.abort();
        chunk?.('late chunk');
        return 'late content';
      }),
    };

    await expect(
      sendMessageWithEndpointFallback({
        content: 'hi',
        history: [],
        model: buildModel(),
        provider: buildProvider({ endpointType: 'openai', endpointTypeCheckedAt: 1 }),
        onChunk,
        client,
        updateProvider,
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });

    expect(onChunk).not.toHaveBeenCalled();
    expect(client.sendMessage).toHaveBeenCalledTimes(1);
    expect(updateProvider).not.toHaveBeenCalled();
  });

  it('retries and surfaces the Anthropic boundary error when the fallback request cannot reach the endpoint', async () => {
    const updateProvider = vi.fn();
    const anthropicFetchError = new Error(
      'Anthropic chat request to https://anthropic.qnaigc.com/v1/messages failed: Failed to fetch',
    );
    const client = {
      sendMessage: vi
        .fn()
        .mockRejectedValueOnce(new Error('OpenAI-compatible chat failed'))
        .mockRejectedValueOnce(anthropicFetchError)
        .mockRejectedValueOnce(anthropicFetchError),
    };

    await expect(
      sendMessageWithEndpointFallback({
        content: 'hi',
        history: [],
        model: buildModel(),
        provider: buildProvider(),
        onChunk: vi.fn(),
        client,
        updateProvider,
        retryDelayMs: 0,
      }),
    ).rejects.toBe(anthropicFetchError);

    expect(client.sendMessage).toHaveBeenCalledTimes(3);
    expect(client.sendMessage.mock.calls[1][3]).toMatchObject({ endpointType: 'anthropic' });
    expect(client.sendMessage.mock.calls[2][3]).toMatchObject({ endpointType: 'anthropic' });
    expect(updateProvider).not.toHaveBeenCalled();
  });
});
