import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAutoTitle } from './useAutoTitle';
import { useUnifiedStore } from '@/stores/unified/useUnifiedStore';
import { sendMessageWithEndpointFallback } from './chatService/sendMessageWithEndpointFallback';
import type { AIModel, Provider } from '@/lib/ai/types';

const mocked = vi.hoisted(() => ({
  saveUnifiedData: vi.fn(),
  loadUnifiedData: vi.fn(async () => ({
    settings: {},
    customIcons: [],
    ai: null,
  })),
  scanGlobalIcons: vi.fn(async () => []),
  sendMessageWithEndpointFallback: vi.fn(),
}));

vi.mock('@/lib/storage/unifiedStorage', () => ({
  loadUnifiedData: mocked.loadUnifiedData,
  saveUnifiedData: mocked.saveUnifiedData,
}));

vi.mock('@/lib/storage/assetStorage', () => ({
  scanGlobalIcons: mocked.scanGlobalIcons,
}));

vi.mock('./chatService/sendMessageWithEndpointFallback', () => ({
  sendMessageWithEndpointFallback: mocked.sendMessageWithEndpointFallback,
}));

const provider: Provider = {
  id: 'provider-1',
  name: 'Provider',
  type: 'newapi',
  endpointType: 'openai',
  endpointTypeCheckedAt: 1,
  apiHost: 'https://example.test/v1',
  apiKey: 'sk-test',
  enabled: true,
  createdAt: 1,
  updatedAt: 1,
};

const model: AIModel = {
  id: 'model-1',
  apiModelId: 'model-1',
  name: 'Model',
  providerId: provider.id,
  enabled: true,
  createdAt: 1,
};

function seedStore() {
  useUnifiedStore.setState({
    loaded: true,
    data: {
      settings: {
        timezone: { offset: 8, city: 'Asia/Shanghai' },
      } as never,
      customIcons: [],
      ai: {
        providers: [provider],
        models: [model],
        benchmarkResults: {},
        fetchedModels: {},
        sessions: [
          { id: 'session-1', title: 'New', modelId: model.id, createdAt: 1, updatedAt: 1 },
        ],
        messages: {
          'session-1': [{
            id: 'u1',
            role: 'user',
            content: 'Draft a database migration plan',
            modelId: model.id,
            timestamp: 1,
            versions: [{
              content: 'Draft a database migration plan',
              createdAt: 1,
              kind: 'original',
              subsequentMessages: [],
            }],
            currentVersionIndex: 0,
          }],
        },
        unreadSessionIds: [],
        selectedModelId: model.id,
        currentSessionId: 'session-1',
        temporaryChatEnabled: false,
        customSystemPrompt: '',
        includeTimeContext: false,
        webSearchEnabled: false,
      },
    },
    undoStack: [],
  });
}

describe('useAutoTitle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    seedStore();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('deduplicates concurrent title generation across hook instances', async () => {
    let resolveTitle!: (value: string) => void;
    const pendingTitle = new Promise<string>((resolve) => {
      resolveTitle = resolve;
    });
    mocked.sendMessageWithEndpointFallback.mockReturnValueOnce(pendingTitle);

    const first = renderHook(() => useAutoTitle());
    const second = renderHook(() => useAutoTitle());

    let firstRequest!: Promise<void>;
    let secondRequest!: Promise<void>;
    await act(async () => {
      firstRequest = first.result.current.generateAutoTitle('session-1', provider.id, model.id);
      secondRequest = second.result.current.generateAutoTitle('session-1', provider.id, model.id);
      await Promise.resolve();
    });

    expect(sendMessageWithEndpointFallback).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveTitle('Migration Plan');
      await Promise.all([firstRequest, secondRequest]);
    });

    await waitFor(() => {
      expect(useUnifiedStore.getState().data.ai?.sessions[0]?.title).toBe('Migration Plan');
    });
  });

  it('does not update the session title when a timed-out title request resolves late', async () => {
    vi.useFakeTimers();
    let resolveTitle!: (value: string) => void;
    let capturedSignal: AbortSignal | undefined;
    const pendingTitle = new Promise<string>((resolve) => {
      resolveTitle = resolve;
    });
    mocked.sendMessageWithEndpointFallback.mockImplementationOnce(({ signal }) => {
      capturedSignal = signal;
      return pendingTitle;
    });

    const { result } = renderHook(() => useAutoTitle());

    let request!: Promise<void>;
    await act(async () => {
      request = result.current.generateAutoTitle('session-1', provider.id, model.id);
      await Promise.resolve();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(12_000);
    });

    expect(capturedSignal?.aborted).toBe(true);

    await act(async () => {
      resolveTitle('Late Title');
      await request;
    });

    expect(useUnifiedStore.getState().data.ai?.sessions[0]?.title).toBe('New');
  });
});
