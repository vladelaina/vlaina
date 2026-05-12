import { describe, expect, it } from 'vitest';
import { retainLoadedSessionMessages } from './useUnifiedStore';
import {
  resolveMarkdownSettings,
  updateMarkdownTypewriterMode,
} from './settings/markdownSettings';
import type { UnifiedData } from '@/lib/storage/unifiedStorage';

function createData(overrides?: Partial<NonNullable<UnifiedData['ai']>>): UnifiedData {
  return {
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

  it('preserves local temporary sessions and messages across disk reloads', () => {
    const previous = createData({
      sessions: [
        { id: 'temp-session-1', title: 'Temporary Chat', modelId: '', createdAt: 1, updatedAt: 1 },
        { id: 'session-1', title: 'First', modelId: '', createdAt: 1, updatedAt: 1 },
      ],
      messages: {
        'temp-session-1': [
          {
            id: 'tmp',
            role: 'user',
            content: 'temporary',
            modelId: '',
            timestamp: 1,
            versions: [{ content: 'temporary', createdAt: 1, subsequentMessages: [] }],
            currentVersionIndex: 0,
          },
        ],
      },
    });

    const next = createData({
      sessions: [
        { id: 'session-2', title: 'Second', modelId: '', createdAt: 2, updatedAt: 2 },
      ],
      messages: {},
    });

    const retained = retainLoadedSessionMessages(previous, next).ai;

    expect(retained?.sessions.map((session) => session.id)).toEqual([
      'temp-session-1',
      'session-2',
    ]);
    expect(retained?.messages['temp-session-1']?.[0]?.content).toBe('temporary');
  });
});

describe('markdownSettings', () => {
  it('defaults typewriter mode off for older settings objects', () => {
    expect(resolveMarkdownSettings({
      codeBlock: { showLineNumbers: false },
    } as Partial<UnifiedData['settings']['markdown']>)).toEqual({
      typewriterMode: false,
      codeBlock: { showLineNumbers: false },
    });
  });

  it('updates typewriter mode without changing code block settings', () => {
    const data: UnifiedData = {
      settings: {
        timezone: { offset: 0, city: 'UTC' },
        markdown: {
          typewriterMode: false,
          codeBlock: { showLineNumbers: false },
        },
      },
      customIcons: [],
      ai: undefined,
    };

    expect(updateMarkdownTypewriterMode(data, true).settings.markdown).toEqual({
      typewriterMode: true,
      codeBlock: { showLineNumbers: false },
    });
  });
});
