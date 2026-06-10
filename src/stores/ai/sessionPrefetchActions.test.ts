import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatMessage } from '@/lib/ai/types';
import { useUnifiedStore } from '../unified/useUnifiedStore';
import { MAX_PENDING_SESSION_PREFETCHES, createSessionPrefetchActions } from './sessionPrefetchActions';

const mocked = vi.hoisted(() => ({
  loadSessionJson: vi.fn(async (): Promise<ChatMessage[] | null> => null),
}));

vi.mock('@/lib/storage/chatStorage', () => ({
  loadSessionJson: mocked.loadSessionJson,
}));

function seedSession(sessionIds = ['session-1']) {
  useUnifiedStore.setState({
    loaded: true,
    data: {
      settings: {} as never,
      customIcons: [],
      ai: {
        providers: [],
        models: [],
        benchmarkResults: {},
        fetchedModels: {},
        sessions: sessionIds.map((id, index) => ({
          id,
          title: `Chat ${index}`,
          modelId: 'model-1',
          createdAt: index + 1,
          updatedAt: index + 1,
        })),
        messages: {},
        unreadSessionIds: [],
        selectedModelId: 'model-1',
        currentSessionId: 'session-1',
        temporaryChatEnabled: false,
        customSystemPrompt: '',
        includeTimeContext: true,
      },
    },
    undoStack: [],
  });
}

describe('sessionPrefetchActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.loadSessionJson.mockResolvedValue(null);
    seedSession();
  });

  it('keeps concurrent callers silent when the shared prefetch fails', async () => {
    let rejectLoad!: (error: Error) => void;
    mocked.loadSessionJson.mockReturnValueOnce(new Promise((_resolve, reject) => {
      rejectLoad = reject;
    }));
    const actions = createSessionPrefetchActions();

    const firstRequest = actions.prefetchSession('session-1');
    await vi.waitFor(() => expect(mocked.loadSessionJson).toHaveBeenCalledWith('session-1'));
    const secondRequest = actions.prefetchSession('session-1');

    rejectLoad(new Error('disk busy'));

    await expect(firstRequest).resolves.toBeUndefined();
    await expect(secondRequest).resolves.toBeUndefined();
    expect(mocked.loadSessionJson).toHaveBeenCalledTimes(1);
  });

  it('skips hover prefetches once pending session prefetches fill the queue budget', async () => {
    const sessionIds = Array.from(
      { length: MAX_PENDING_SESSION_PREFETCHES + 1 },
      (_value, index) => `session-${index}`,
    );
    seedSession(sessionIds);
    let releaseLoad!: () => void;
    const loadGate = new Promise<void>((resolve) => {
      releaseLoad = resolve;
    });
    mocked.loadSessionJson.mockImplementation(async () => {
      await loadGate;
      return null;
    });
    const actions = createSessionPrefetchActions();

    const requests = sessionIds.map((sessionId) => actions.prefetchSession(sessionId));

    await vi.waitFor(() => expect(mocked.loadSessionJson).toHaveBeenCalledTimes(2));
    await expect(requests[MAX_PENDING_SESSION_PREFETCHES]).resolves.toBeUndefined();

    releaseLoad();
    await Promise.all(requests.slice(0, MAX_PENDING_SESSION_PREFETCHES));

    expect(mocked.loadSessionJson).toHaveBeenCalledTimes(MAX_PENDING_SESSION_PREFETCHES);
  });
});
