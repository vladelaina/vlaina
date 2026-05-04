import { describe, expect, it, vi } from 'vitest';
import type { AIModel, Provider } from '@/lib/ai/types';
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
  it('uses the recorded endpoint type without trying fallback again', async () => {
    const updateProvider = vi.fn();
    const onChunk = vi.fn();
    const client = {
      sendMessage: vi.fn().mockResolvedValue('openai ok'),
    };

    const result = await sendMessageWithEndpointFallback({
      content: 'hi',
      history: [],
      model: buildModel(),
      provider: buildProvider({ endpointType: 'openai' }),
      onChunk,
      client,
      updateProvider,
    });

    expect(result).toBe('openai ok');
    expect(client.sendMessage).toHaveBeenCalledTimes(1);
    expect(client.sendMessage.mock.calls[0][3]).toMatchObject({ endpointType: 'openai' });
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
    expect(updateProvider).toHaveBeenCalledWith('provider-1', { endpointType: 'anthropic' });
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

  it('surfaces the Anthropic boundary error when the fallback request cannot reach the endpoint', async () => {
    const updateProvider = vi.fn();
    const anthropicFetchError = new Error(
      'Anthropic chat request to https://anthropic.qnaigc.com/v1/messages failed: Failed to fetch',
    );
    const client = {
      sendMessage: vi
        .fn()
        .mockRejectedValueOnce(new Error('OpenAI-compatible chat failed'))
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
      }),
    ).rejects.toBe(anthropicFetchError);

    expect(client.sendMessage).toHaveBeenCalledTimes(2);
    expect(client.sendMessage.mock.calls[1][3]).toMatchObject({ endpointType: 'anthropic' });
    expect(updateProvider).not.toHaveBeenCalled();
  });
});
