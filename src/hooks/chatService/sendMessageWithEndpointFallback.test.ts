import { describe, expect, it, vi } from 'vitest';
import { AIErrorType, type AIModel, type Provider } from '@/lib/ai/types';
import { useUIStore } from '@/stores/uiSlice';
import { sendMessageWithEndpointFallback } from './sendMessageWithEndpointFallback';
import {
  DEV_RETRY_SIMULATION_STORAGE_KEY,
  DEV_VISIBLE_RETRY_DELAY_STORAGE_KEY,
} from './preStreamRetry';

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

function buildOpenAIModel(): AIModel {
  return buildModel({
    id: 'provider-1::gpt-4o-mini',
    apiModelId: 'gpt-4o-mini',
    name: 'GPT 4o Mini',
  });
}

function buildManagedProvider(): Provider {
  return buildProvider({
    id: 'vlaina-managed',
    name: 'vlaina AI',
    apiHost: 'https://api.vlaina.com/v1',
    apiKey: '',
  });
}

function buildManagedModel(overrides: Partial<AIModel> = {}): AIModel {
  return buildModel({
    id: 'vlaina-managed::claude-sonnet-4-5',
    providerId: 'vlaina-managed',
    ...overrides,
  });
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

  it('falls back to Anthropic for a Claude model even after the provider was verified as OpenAI', async () => {
    const updateProvider = vi.fn();
    const updateModel = vi.fn();
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
      provider: buildProvider({ endpointType: 'openai', endpointTypeCheckedAt: 1 }),
      onChunk: vi.fn(),
      client,
      updateProvider,
      updateModel,
      retryDelayMs: 0,
    });

    expect(result).toBe('anthropic ok');
    expect(client.sendMessage).toHaveBeenCalledTimes(2);
    expect(client.sendMessage.mock.calls[0][3]).toMatchObject({ endpointType: 'openai' });
    expect(client.sendMessage.mock.calls[1][3]).toMatchObject({ endpointType: 'anthropic' });
    expect(updateProvider).not.toHaveBeenCalled();
    expect(updateModel).toHaveBeenCalledWith('provider-1::claude-sonnet-4-5', {
      endpointType: 'anthropic',
      endpointTypeCheckedAt: expect.any(Number),
    });
  });

  it('does not hide OpenAI-compatible rate limits for Claude models behind Anthropic fallback', async () => {
    const updateProvider = vi.fn();
    const updateModel = vi.fn();
    const rateLimitError = {
      type: AIErrorType.RATE_LIMIT,
      message: 'Too many requests',
      statusCode: 429,
    };
    const client = {
      sendMessage: vi.fn().mockRejectedValue(rateLimitError),
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
        updateModel,
        retryDelayMs: 0,
      }),
    ).rejects.toBe(rateLimitError);

    expect(client.sendMessage).toHaveBeenCalledTimes(1);
    expect(updateProvider).not.toHaveBeenCalled();
    expect(updateModel).not.toHaveBeenCalled();
  });

  it('falls back to Anthropic for verified OpenAI Claude models on endpoint-shaped failures', async () => {
    const updateProvider = vi.fn();
    const updateModel = vi.fn();
    const client = {
      sendMessage: vi
        .fn()
        .mockRejectedValueOnce({
          type: AIErrorType.INVALID_REQUEST,
          message: 'Not found',
          statusCode: 404,
        })
        .mockResolvedValueOnce('anthropic ok'),
    };

    const result = await sendMessageWithEndpointFallback({
      content: 'hi',
      history: [],
      model: buildModel(),
      provider: buildProvider({ endpointType: 'openai', endpointTypeCheckedAt: 1 }),
      onChunk: vi.fn(),
      client,
      updateProvider,
      updateModel,
      retryDelayMs: 0,
    });

    expect(result).toBe('anthropic ok');
    expect(client.sendMessage).toHaveBeenCalledTimes(2);
    expect(client.sendMessage.mock.calls[1][3]).toMatchObject({ endpointType: 'anthropic' });
  });

  it('falls back to Anthropic for verified OpenAI Claude models on 403 endpoint mismatch messages', async () => {
    const updateProvider = vi.fn();
    const updateModel = vi.fn();
    const client = {
      sendMessage: vi
        .fn()
        .mockRejectedValueOnce({
          type: AIErrorType.SERVER_ERROR,
          message: '模型 claude-sonnet-4-6 不支持 /v1/chat/completions 接口',
          statusCode: 403,
        })
        .mockResolvedValueOnce('anthropic ok'),
    };

    const result = await sendMessageWithEndpointFallback({
      content: 'hi',
      history: [],
      model: buildModel({
        id: 'provider-1::claude-sonnet-4-6',
        apiModelId: 'claude-sonnet-4-6',
        name: 'Claude Sonnet 4.6',
      }),
      provider: buildProvider({ endpointType: 'openai', endpointTypeCheckedAt: 1 }),
      onChunk: vi.fn(),
      client,
      updateProvider,
      updateModel,
      retryDelayMs: 0,
    });

    expect(result).toBe('anthropic ok');
    expect(client.sendMessage).toHaveBeenCalledTimes(2);
    expect(client.sendMessage.mock.calls[0][3]).toMatchObject({ endpointType: 'openai' });
    expect(client.sendMessage.mock.calls[1][3]).toMatchObject({ endpointType: 'anthropic' });
    expect(updateProvider).not.toHaveBeenCalled();
    expect(updateModel).toHaveBeenCalledWith('provider-1::claude-sonnet-4-6', {
      endpointType: 'anthropic',
      endpointTypeCheckedAt: expect.any(Number),
    });
  });

  it('does not treat ordinary 403 provider rejections as endpoint fallback signals', async () => {
    const updateProvider = vi.fn();
    const updateModel = vi.fn();
    const forbiddenError = {
      type: AIErrorType.SERVER_ERROR,
      message: 'Forbidden request. Check account balance or model access.',
      statusCode: 403,
    };
    const client = {
      sendMessage: vi.fn().mockRejectedValue(forbiddenError),
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
        updateModel,
        retryDelayMs: 0,
      }),
    ).rejects.toBe(forbiddenError);

    expect(client.sendMessage).toHaveBeenCalledTimes(1);
    expect(updateProvider).not.toHaveBeenCalled();
    expect(updateModel).not.toHaveBeenCalled();
  });

  it('uses a verified model endpoint type ahead of the provider endpoint type', async () => {
    const updateProvider = vi.fn();
    const updateModel = vi.fn();
    const client = {
      sendMessage: vi.fn().mockResolvedValue('anthropic ok'),
    };

    const result = await sendMessageWithEndpointFallback({
      content: 'hi',
      history: [],
      model: buildModel({ endpointType: 'anthropic', endpointTypeCheckedAt: 1 }),
      provider: buildProvider({ endpointType: 'openai', endpointTypeCheckedAt: 1 }),
      onChunk: vi.fn(),
      client,
      updateProvider,
      updateModel,
    });

    expect(result).toBe('anthropic ok');
    expect(client.sendMessage).toHaveBeenCalledTimes(1);
    expect(client.sendMessage.mock.calls[0][3]).toMatchObject({ endpointType: 'anthropic' });
    expect(updateProvider).not.toHaveBeenCalled();
    expect(updateModel).not.toHaveBeenCalled();
  });

  it('falls back to OpenAI when a verified model Anthropic endpoint no longer matches a Claude model', async () => {
    const updateProvider = vi.fn();
    const updateModel = vi.fn();
    const client = {
      sendMessage: vi
        .fn()
        .mockRejectedValueOnce({
          type: AIErrorType.INVALID_REQUEST,
          message: 'Not found',
          statusCode: 404,
        })
        .mockResolvedValueOnce('openai ok'),
    };

    const result = await sendMessageWithEndpointFallback({
      content: 'hi',
      history: [],
      model: buildModel({ endpointType: 'anthropic', endpointTypeCheckedAt: 1 }),
      provider: buildProvider({ endpointType: 'openai', endpointTypeCheckedAt: 1 }),
      onChunk: vi.fn(),
      client,
      updateProvider,
      updateModel,
      retryDelayMs: 0,
    });

    expect(result).toBe('openai ok');
    expect(client.sendMessage).toHaveBeenCalledTimes(2);
    expect(client.sendMessage.mock.calls[0][3]).toMatchObject({ endpointType: 'anthropic' });
    expect(client.sendMessage.mock.calls[1][3]).toMatchObject({ endpointType: 'openai' });
    expect(updateProvider).not.toHaveBeenCalled();
    expect(updateModel).toHaveBeenCalledWith('provider-1::claude-sonnet-4-5', {
      endpointType: 'openai',
      endpointTypeCheckedAt: expect.any(Number),
    });
  });

  it('ignores verified model endpoint type for managed Claude models', async () => {
    const updateProvider = vi.fn();
    const updateModel = vi.fn();
    const client = {
      sendMessage: vi.fn().mockResolvedValue('managed anthropic ok'),
    };

    const result = await sendMessageWithEndpointFallback({
      content: 'hi',
      history: [],
      model: buildManagedModel({ endpointType: 'anthropic', endpointTypeCheckedAt: 1 }),
      provider: buildManagedProvider(),
      onChunk: vi.fn(),
      client,
      updateProvider,
      updateModel,
    });

    expect(result).toBe('managed anthropic ok');
    expect(client.sendMessage).toHaveBeenCalledTimes(1);
    expect(client.sendMessage.mock.calls[0][3]).toMatchObject({
      id: 'vlaina-managed',
    });
    expect(client.sendMessage.mock.calls[0][3].endpointType).toBeUndefined();
    expect(updateProvider).not.toHaveBeenCalled();
    expect(updateModel).not.toHaveBeenCalled();
  });

  it('does not fall back from cached managed Anthropic models on managed quota errors', async () => {
    const updateProvider = vi.fn();
    const updateModel = vi.fn();
    const quotaError = Object.assign(new Error('MANAGED_QUOTA_EXHAUSTED'), {
      errorCode: 'points_exhausted',
    });
    const client = {
      sendMessage: vi.fn().mockRejectedValue(quotaError),
    };

    await expect(sendMessageWithEndpointFallback({
      content: 'hi',
      history: [],
      model: buildManagedModel({ endpointType: 'anthropic', endpointTypeCheckedAt: 1 }),
      provider: buildManagedProvider(),
      onChunk: vi.fn(),
      client,
      updateProvider,
      updateModel,
      retryDelayMs: 0,
    })).rejects.toBe(quotaError);

    expect(client.sendMessage).toHaveBeenCalledTimes(1);
    expect(client.sendMessage.mock.calls[0][3]).toMatchObject({
      id: 'vlaina-managed',
    });
    expect(client.sendMessage.mock.calls[0][3].endpointType).toBeUndefined();
    expect(updateProvider).not.toHaveBeenCalled();
    expect(updateModel).not.toHaveBeenCalled();
  });

  it('does not write endpoint state after managed success', async () => {
    const updateProvider = vi.fn();
    const updateModel = vi.fn();
    const client = {
      sendMessage: vi.fn().mockResolvedValue('managed openai ok'),
    };

    const result = await sendMessageWithEndpointFallback({
      content: 'hi',
      history: [],
      model: buildManagedModel({
        id: 'vlaina-managed::gpt-4o-mini',
        apiModelId: 'gpt-4o-mini',
        name: 'GPT 4o Mini',
      }),
      provider: buildManagedProvider(),
      onChunk: vi.fn(),
      client,
      updateProvider,
      updateModel,
    });

    expect(result).toBe('managed openai ok');
    expect(client.sendMessage).toHaveBeenCalledTimes(1);
    expect(client.sendMessage.mock.calls[0][3].endpointType).toBeUndefined();
    expect(updateProvider).not.toHaveBeenCalled();
    expect(updateModel).not.toHaveBeenCalled();
  });

  it('retries a verified endpoint when a transient error happens before streaming output', async () => {
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

  it('shows a visible countdown after three transient retries and then retries again', async () => {
    vi.useFakeTimers();
    try {
      useUIStore.setState({ languagePreference: 'zh-CN' });
      const updateProvider = vi.fn();
      const onRetryStatus = vi.fn();
      const transientError = {
        type: AIErrorType.SERVER_ERROR,
        message: 'Service unavailable',
        statusCode: 503,
      };
      const client = {
        sendMessage: vi
          .fn()
          .mockRejectedValueOnce(transientError)
          .mockRejectedValueOnce(transientError)
          .mockRejectedValueOnce(transientError)
          .mockRejectedValueOnce(transientError)
          .mockResolvedValueOnce('eventual ok'),
      };

      const request = sendMessageWithEndpointFallback({
        content: 'hi',
        history: [],
        model: buildOpenAIModel(),
        provider: buildProvider({ endpointType: 'openai', endpointTypeCheckedAt: 1 }),
        onChunk: vi.fn(),
        client,
        updateProvider,
        retryDelayMs: 0,
        options: { onRetryStatus },
      });
      request.catch(() => undefined);

      await vi.waitFor(() => {
        expect(onRetryStatus).toHaveBeenCalledWith('Service unavailable\n30秒后重试 - 第4次重试');
      });
      expect(client.sendMessage).toHaveBeenCalledTimes(4);

      await vi.advanceTimersByTimeAsync(1000);
      expect(onRetryStatus).toHaveBeenLastCalledWith('Service unavailable\n29秒后重试 - 第4次重试');

      await vi.advanceTimersByTimeAsync(29_000);
      await expect(request).resolves.toBe('eventual ok');
      expect(client.sendMessage).toHaveBeenCalledTimes(5);
    } finally {
      vi.useRealTimers();
    }
  });

  it('backs off visible retry countdowns after the first visible retry', async () => {
    vi.useFakeTimers();
    try {
      useUIStore.setState({ languagePreference: 'zh-CN' });
      const transientError = {
        type: AIErrorType.SERVER_ERROR,
        message: 'Service unavailable',
        statusCode: 503,
      };
      const client = {
        sendMessage: vi
          .fn()
          .mockRejectedValueOnce(transientError)
          .mockRejectedValueOnce(transientError)
          .mockRejectedValueOnce(transientError)
          .mockRejectedValueOnce(transientError)
          .mockRejectedValueOnce(transientError)
          .mockResolvedValueOnce('eventual ok'),
      };
      const onRetryStatus = vi.fn();

      const request = sendMessageWithEndpointFallback({
        content: 'hi',
        history: [],
        model: buildOpenAIModel(),
        provider: buildProvider({ endpointType: 'openai', endpointTypeCheckedAt: 1 }),
        onChunk: vi.fn(),
        client,
        retryDelayMs: 0,
        options: { onRetryStatus },
      });
      request.catch(() => undefined);

      await vi.waitFor(() => {
        expect(onRetryStatus).toHaveBeenCalledWith('Service unavailable\n30秒后重试 - 第4次重试');
      });

      await vi.advanceTimersByTimeAsync(30_000);
      await vi.waitFor(() => {
        expect(onRetryStatus).toHaveBeenCalledWith('Service unavailable\n45秒后重试 - 第5次重试');
      });

      await vi.advanceTimersByTimeAsync(45_000);
      await expect(request).resolves.toBe('eventual ok');
      expect(client.sendMessage).toHaveBeenCalledTimes(6);
    } finally {
      vi.useRealTimers();
    }
  });

  it('uses the dev one-second visible retry delay when enabled', async () => {
    vi.useFakeTimers();
    try {
      window.localStorage.setItem(DEV_VISIBLE_RETRY_DELAY_STORAGE_KEY, 'true');
      useUIStore.setState({ languagePreference: 'zh-CN' });
      const transientError = {
        type: AIErrorType.SERVER_ERROR,
        message: 'Service unavailable',
        statusCode: 503,
      };
      const client = {
        sendMessage: vi
          .fn()
          .mockRejectedValueOnce(transientError)
          .mockRejectedValueOnce(transientError)
          .mockRejectedValueOnce(transientError)
          .mockRejectedValueOnce(transientError)
          .mockResolvedValueOnce('fast retry ok'),
      };
      const onRetryStatus = vi.fn();

      const request = sendMessageWithEndpointFallback({
        content: 'hi',
        history: [],
        model: buildOpenAIModel(),
        provider: buildProvider({ endpointType: 'openai', endpointTypeCheckedAt: 1 }),
        onChunk: vi.fn(),
        client,
        retryDelayMs: 0,
        options: { onRetryStatus },
      });
      request.catch(() => undefined);

      await vi.waitFor(() => {
        expect(onRetryStatus).toHaveBeenCalledWith('Service unavailable\n1秒后重试 - 第4次重试');
      });

      await vi.advanceTimersByTimeAsync(1000);
      await expect(request).resolves.toBe('fast retry ok');
      expect(client.sendMessage).toHaveBeenCalledTimes(5);
    } finally {
      window.localStorage.removeItem(DEV_VISIBLE_RETRY_DELAY_STORAGE_KEY);
      vi.useRealTimers();
    }
  });

  it('uses simulated upstream failures instead of the configured channel when retry simulation is enabled', async () => {
    vi.useFakeTimers();
    try {
      window.localStorage.setItem(DEV_RETRY_SIMULATION_STORAGE_KEY, 'true');
      useUIStore.setState({ languagePreference: 'zh-CN' });
      const controller = new AbortController();
      const client = {
        sendMessage: vi.fn().mockResolvedValue('real channel answer'),
      };
      const onRetryStatus = vi.fn();

      const request = sendMessageWithEndpointFallback({
        content: 'hi',
        history: [],
        model: buildOpenAIModel(),
        provider: buildProvider({ endpointType: 'openai', endpointTypeCheckedAt: 1 }),
        onChunk: vi.fn(),
        client,
        signal: controller.signal,
        retryDelayMs: 0,
        options: { onRetryStatus },
      });
      request.catch(() => undefined);

      await vi.waitFor(() => {
        expect(onRetryStatus).toHaveBeenCalledWith('Service unavailable\n1秒后重试 - 第4次重试');
      });
      expect(client.sendMessage).not.toHaveBeenCalled();

      controller.abort();
      await vi.advanceTimersByTimeAsync(1000);
      await expect(request).rejects.toMatchObject({ name: 'AbortError' });
    } finally {
      window.localStorage.removeItem(DEV_RETRY_SIMULATION_STORAGE_KEY);
      vi.useRealTimers();
    }
  });

  it('stops waiting and does not continue retrying after the request is paused', async () => {
    vi.useFakeTimers();
    try {
      useUIStore.setState({ languagePreference: 'zh-CN' });
      const controller = new AbortController();
      const transientError = {
        type: AIErrorType.SERVER_ERROR,
        message: 'Service unavailable',
        statusCode: 503,
      };
      const client = {
        sendMessage: vi.fn().mockRejectedValue(transientError),
      };
      const onRetryStatus = vi.fn();

      const request = sendMessageWithEndpointFallback({
        content: 'hi',
        history: [],
        model: buildOpenAIModel(),
        provider: buildProvider({ endpointType: 'openai', endpointTypeCheckedAt: 1 }),
        onChunk: vi.fn(),
        client,
        signal: controller.signal,
        retryDelayMs: 0,
        options: { onRetryStatus },
      });
      request.catch(() => undefined);

      await vi.waitFor(() => {
        expect(onRetryStatus).toHaveBeenCalledWith('Service unavailable\n30秒后重试 - 第4次重试');
      });
      expect(client.sendMessage).toHaveBeenCalledTimes(4);

      controller.abort();
      await vi.advanceTimersByTimeAsync(30_000);
      await expect(request).rejects.toMatchObject({ name: 'AbortError' });
      expect(client.sendMessage).toHaveBeenCalledTimes(4);
    } finally {
      vi.useRealTimers();
    }
  });

  it('retries transient string HTTP status codes before streaming output', async () => {
    const updateProvider = vi.fn();
    const client = {
      sendMessage: vi
        .fn()
        .mockRejectedValueOnce({
          message: 'Service unavailable',
          statusCode: ' 503 ',
        })
        .mockResolvedValueOnce('retry ok'),
    };

    const result = await sendMessageWithEndpointFallback({
      content: 'hi',
      history: [],
      model: buildModel(),
      provider: buildProvider({ endpointType: 'openai', endpointTypeCheckedAt: 1 }),
      onChunk: vi.fn(),
      client,
      updateProvider,
      retryDelayMs: 0,
    });

    expect(result).toBe('retry ok');
    expect(client.sendMessage).toHaveBeenCalledTimes(2);
  });

  it('does not retry loosely formatted or overlong status code strings', async () => {
    const updateProvider = vi.fn();
    const transientError = {
      message: 'opaque failure',
      statusCode: '0x1f7',
    };
    const client = {
      sendMessage: vi.fn().mockRejectedValue(transientError),
    };

    await expect(
      sendMessageWithEndpointFallback({
        content: 'hi',
        history: [],
        model: buildOpenAIModel(),
        provider: buildProvider({ endpointType: 'openai', endpointTypeCheckedAt: 1 }),
        onChunk: vi.fn(),
        client,
        updateProvider,
        retryDelayMs: 0,
      }),
    ).rejects.toBe(transientError);

    expect(client.sendMessage).toHaveBeenCalledTimes(1);
  });

  it('does not retry overlong error code strings', async () => {
    const updateProvider = vi.fn();
    const transientError = {
      errorCode: `${' '.repeat(129)}upstream_unavailable`,
      message: 'opaque failure',
    };
    const client = {
      sendMessage: vi.fn().mockRejectedValue(transientError),
    };

    await expect(
      sendMessageWithEndpointFallback({
        content: 'hi',
        history: [],
        model: buildOpenAIModel(),
        provider: buildProvider({ endpointType: 'openai', endpointTypeCheckedAt: 1 }),
        onChunk: vi.fn(),
        client,
        updateProvider,
        retryDelayMs: 0,
      }),
    ).rejects.toBe(transientError);

    expect(client.sendMessage).toHaveBeenCalledTimes(1);
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
        model: buildOpenAIModel(),
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

  it('falls back to OpenAI for a Claude model when the verified provider Anthropic endpoint does not match that model', async () => {
    const updateProvider = vi.fn();
    const updateModel = vi.fn();
    const client = {
      sendMessage: vi
        .fn()
        .mockRejectedValueOnce({
          type: AIErrorType.INVALID_REQUEST,
          message: 'Not found',
          statusCode: 404,
        })
        .mockResolvedValueOnce('openai ok'),
    };

    const result = await sendMessageWithEndpointFallback({
      content: 'hi',
      history: [],
      model: buildModel(),
      provider: buildProvider({ endpointType: 'anthropic', endpointTypeCheckedAt: 1 }),
      onChunk: vi.fn(),
      client,
      updateProvider,
      updateModel,
      retryDelayMs: 0,
    });

    expect(result).toBe('openai ok');
    expect(client.sendMessage).toHaveBeenCalledTimes(2);
    expect(client.sendMessage.mock.calls[0][3]).toMatchObject({ endpointType: 'anthropic' });
    expect(client.sendMessage.mock.calls[1][3]).toMatchObject({ endpointType: 'openai' });
    expect(updateProvider).not.toHaveBeenCalled();
    expect(updateModel).toHaveBeenCalledWith('provider-1::claude-sonnet-4-5', {
      endpointType: 'openai',
      endpointTypeCheckedAt: expect.any(Number),
    });
  });

  it('tries Anthropic and records it when the first OpenAI-compatible chat fails before streaming output', async () => {
    const updateProvider = vi.fn();
    const updateModel = vi.fn();
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
      updateModel,
    });

    expect(result).toBe('anthropic ok');
    expect(client.sendMessage).toHaveBeenCalledTimes(2);
    expect(client.sendMessage.mock.calls[0][3]).toMatchObject({ endpointType: 'openai' });
    expect(client.sendMessage.mock.calls[1][3]).toMatchObject({ endpointType: 'anthropic' });
    expect(updateProvider).not.toHaveBeenCalled();
    expect(updateModel).toHaveBeenCalledWith('provider-1::claude-sonnet-4-5', {
      endpointType: 'anthropic',
      endpointTypeCheckedAt: expect.any(Number),
    });
  });

  it('records endpoint discovery on the concrete provider model when the same Claude id exists in multiple providers', async () => {
    const updateProvider = vi.fn();
    const updateModel = vi.fn();
    const client = {
      sendMessage: vi
        .fn()
        .mockRejectedValueOnce({
          type: AIErrorType.SERVER_ERROR,
          message: '模型 claude-sonnet-4-6 不支持 /v1/chat/completions 接口',
          statusCode: 403,
        })
        .mockResolvedValueOnce('provider 2 anthropic ok'),
    };

    const result = await sendMessageWithEndpointFallback({
      content: 'hi',
      history: [],
      model: buildModel({
        id: 'provider-2::claude-sonnet-4-6',
        providerId: 'provider-2',
        apiModelId: 'claude-sonnet-4-6',
        name: 'Claude Sonnet 4.6',
      }),
      provider: buildProvider({
        id: 'provider-2',
        endpointType: 'openai',
        endpointTypeCheckedAt: 1,
      }),
      onChunk: vi.fn(),
      client,
      updateProvider,
      updateModel,
      retryDelayMs: 0,
    });

    expect(result).toBe('provider 2 anthropic ok');
    expect(client.sendMessage).toHaveBeenCalledTimes(2);
    expect(updateProvider).not.toHaveBeenCalled();
    expect(updateModel).toHaveBeenCalledTimes(1);
    expect(updateModel).toHaveBeenCalledWith('provider-2::claude-sonnet-4-6', {
      endpointType: 'anthropic',
      endpointTypeCheckedAt: expect.any(Number),
    });
  });

  it('does not hide first-run OpenAI-compatible rate limits behind Anthropic discovery', async () => {
    const updateProvider = vi.fn();
    const updateModel = vi.fn();
    const rateLimitError = {
      type: AIErrorType.RATE_LIMIT,
      message: 'Too many requests',
      statusCode: 429,
    };
    const client = {
      sendMessage: vi.fn().mockRejectedValue(rateLimitError),
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
        updateModel,
        retryDelayMs: 0,
      }),
    ).rejects.toBe(rateLimitError);

    expect(client.sendMessage).toHaveBeenCalledTimes(1);
    expect(client.sendMessage.mock.calls[0][3]).toMatchObject({ endpointType: 'openai' });
    expect(updateProvider).not.toHaveBeenCalled();
    expect(updateModel).not.toHaveBeenCalled();
  });

  it('does not probe Anthropic during first-run discovery for non-Claude models', async () => {
    const updateProvider = vi.fn();
    const updateModel = vi.fn();
    const openAIError = {
      type: AIErrorType.SERVER_ERROR,
      message: 'OpenAI-compatible chat failed',
      statusCode: 400,
    };
    const client = {
      sendMessage: vi.fn().mockRejectedValue(openAIError),
    };

    await expect(
      sendMessageWithEndpointFallback({
        content: 'hi',
        history: [],
        model: buildOpenAIModel(),
        provider: buildProvider(),
        onChunk: vi.fn(),
        client,
        updateProvider,
        updateModel,
        retryDelayMs: 0,
      }),
    ).rejects.toBe(openAIError);

    expect(client.sendMessage).toHaveBeenCalledTimes(1);
    expect(client.sendMessage.mock.calls[0][3]).toMatchObject({ endpointType: 'openai' });
    expect(updateProvider).not.toHaveBeenCalled();
    expect(updateModel).not.toHaveBeenCalled();
  });

  it('still probes Anthropic during first-run discovery after an OpenAI-compatible auth-shaped failure', async () => {
    const updateProvider = vi.fn();
    const updateModel = vi.fn();
    const client = {
      sendMessage: vi
        .fn()
        .mockRejectedValueOnce({
          type: AIErrorType.AUTH_ERROR,
          message: 'Invalid API key or unauthorized access.',
          statusCode: 401,
        })
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
      updateModel,
      retryDelayMs: 0,
    });

    expect(result).toBe('anthropic ok');
    expect(client.sendMessage).toHaveBeenCalledTimes(2);
    expect(client.sendMessage.mock.calls[0][3]).toMatchObject({ endpointType: 'openai' });
    expect(client.sendMessage.mock.calls[1][3]).toMatchObject({ endpointType: 'anthropic' });
    expect(updateProvider).not.toHaveBeenCalled();
    expect(updateModel).toHaveBeenCalledWith('provider-1::claude-sonnet-4-5', {
      endpointType: 'anthropic',
      endpointTypeCheckedAt: expect.any(Number),
    });
  });

  it('keeps retrying abort-shaped OpenAI pre-stream failures when still active', async () => {
    vi.useFakeTimers();
    try {
      useUIStore.setState({ languagePreference: 'zh-CN' });
      const updateProvider = vi.fn();
      const updateModel = vi.fn();
      const onRetryStatus = vi.fn();
      const resetError = new DOMException('openai stream reset', 'AbortError');
      const client = {
        sendMessage: vi
          .fn()
          .mockRejectedValueOnce(resetError)
          .mockRejectedValueOnce(resetError)
          .mockRejectedValueOnce(resetError)
          .mockRejectedValueOnce(resetError)
          .mockResolvedValueOnce('openai ok'),
      };

      const request = sendMessageWithEndpointFallback({
        content: 'hi',
        history: [],
        model: buildModel(),
        provider: buildProvider(),
        onChunk: vi.fn(),
        client,
        updateProvider,
        updateModel,
        retryDelayMs: 0,
        options: { onRetryStatus },
      });
      request.catch(() => undefined);

      await vi.waitFor(() => {
        expect(onRetryStatus).toHaveBeenCalledWith('openai stream reset\n30秒后重试 - 第4次重试');
      });
      await vi.advanceTimersByTimeAsync(30_000);

      expect(await request).toBe('openai ok');
      expect(client.sendMessage).toHaveBeenCalledTimes(5);
      expect(client.sendMessage.mock.calls[0][3]).toMatchObject({ endpointType: 'openai' });
      expect(client.sendMessage.mock.calls[4][3]).toMatchObject({ endpointType: 'openai' });
      expect(updateProvider).toHaveBeenCalledWith('provider-1', {
        endpointType: 'openai',
        endpointTypeCheckedAt: expect.any(Number),
      });
      expect(updateModel).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
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
    const updateModel = vi.fn();
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
        updateModel,
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });

    expect(client.sendMessage).toHaveBeenCalledTimes(2);
    expect(client.sendMessage.mock.calls[0][3]).toMatchObject({ endpointType: 'openai' });
    expect(client.sendMessage.mock.calls[1][3]).toMatchObject({ endpointType: 'anthropic' });
    expect(updateProvider).not.toHaveBeenCalled();
    expect(updateModel).not.toHaveBeenCalled();
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

  it('keeps retrying the Anthropic boundary error after the quick retries are exhausted', async () => {
    vi.useFakeTimers();
    try {
      useUIStore.setState({ languagePreference: 'zh-CN' });
      const updateProvider = vi.fn();
      const onRetryStatus = vi.fn();
      const anthropicFetchError = new Error(
        'Anthropic chat request to https://anthropic.qnaigc.com/v1/messages failed: Failed to fetch',
      );
      const client = {
        sendMessage: vi
          .fn()
          .mockRejectedValueOnce(new Error('OpenAI-compatible chat failed'))
          .mockRejectedValueOnce(anthropicFetchError)
          .mockRejectedValueOnce(anthropicFetchError)
          .mockRejectedValueOnce(anthropicFetchError)
          .mockRejectedValueOnce(anthropicFetchError)
          .mockResolvedValueOnce('anthropic ok'),
      };

      const request = sendMessageWithEndpointFallback({
        content: 'hi',
        history: [],
        model: buildModel(),
        provider: buildProvider(),
        onChunk: vi.fn(),
        client,
        updateProvider,
        retryDelayMs: 0,
        options: { onRetryStatus },
      });
      request.catch(() => undefined);

      await vi.waitFor(() => {
        expect(onRetryStatus).toHaveBeenCalledWith(
          'Anthropic chat request to https://anthropic.qnaigc.com/v1/messages failed: Failed to fetch\n30秒后重试 - 第4次重试',
        );
      });
      await vi.advanceTimersByTimeAsync(30_000);

      await expect(request).resolves.toBe('anthropic ok');
      expect(client.sendMessage).toHaveBeenCalledTimes(6);
      expect(client.sendMessage.mock.calls[1][3]).toMatchObject({ endpointType: 'anthropic' });
      expect(client.sendMessage.mock.calls[5][3]).toMatchObject({ endpointType: 'anthropic' });
      expect(updateProvider).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
