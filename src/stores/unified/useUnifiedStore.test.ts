import { describe, expect, it } from 'vitest';
import { retainLoadedSessionMessages } from './useUnifiedStore';
import type { UnifiedData } from '@/lib/storage/unifiedStorage';

function createData(overrides?: Partial<NonNullable<UnifiedData['ai']>>): UnifiedData {
  return {
    progress: [],
    settings: {} as never,
    customIcons: [],
    ai: {
      providers: [],
      models: [],
      benchmarkResults: {},
      fetchedModels: {},
      sessions: [],
      messages: {},
      unreadSessionIds: [],
      selectedModelId: null,
      currentSessionId: null,
      temporaryChatEnabled: false,
      customSystemPrompt: '',
      includeTimeContext: true,
      ...overrides,
    },
  };
}

describe('retainLoadedSessionMessages', () => {
  it('keeps already loaded messages for sessions that still exist after reload', () => {
    const previous = createData({
      sessions: [
        { id: 'session-1', title: 'First', modelId: '', createdAt: 1, updatedAt: 1 },
        { id: 'session-2', title: 'Second', modelId: '', createdAt: 2, updatedAt: 2 },
      ],
      messages: {
        'session-1': [
          {
            id: 'm1',
            role: 'user',
            content: 'hello',
            modelId: '',
            timestamp: 1,
            versions: [{ content: 'hello', createdAt: 1, subsequentMessages: [] }],
            currentVersionIndex: 0,
          },
        ],
        'session-2': [],
      },
    });

    const next = createData({
      sessions: [
        { id: 'session-1', title: 'First', modelId: '', createdAt: 1, updatedAt: 3 },
        { id: 'session-3', title: 'Third', modelId: '', createdAt: 3, updatedAt: 3 },
      ],
      messages: {},
    });

    const session1Messages = previous.ai?.messages['session-1'] || [];

    expect(retainLoadedSessionMessages(previous, next).ai?.messages).toEqual({
      'session-1': session1Messages,
    });
  });
});
