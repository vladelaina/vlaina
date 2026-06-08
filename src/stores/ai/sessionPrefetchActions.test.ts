import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatMessage } from '@/lib/ai/types';
import { useUnifiedStore } from '../unified/useUnifiedStore';
import { createSessionPrefetchActions } from './sessionPrefetchActions';

const mocked = vi.hoisted(() => ({
  loadSessionJson: vi.fn(async (): Promise<ChatMessage[] | null> => null),
}));

vi.mock('@/lib/storage/chatStorage', () => ({
  loadSessionJson: mocked.loadSessionJson,
}));

function seedSession() {
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
        sessions: [{ id: 'session-1', title: 'Chat', modelId: 'model-1', createdAt: 1, updatedAt: 1 }],
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
});
