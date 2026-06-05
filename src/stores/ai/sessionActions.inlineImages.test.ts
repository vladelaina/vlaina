import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChatMessage } from '@/lib/ai/types'
import { useUnifiedStore } from '../unified/useUnifiedStore'
import { useAIUIStore } from './chatState'

const mocked = vi.hoisted(() => ({
  parseMarkdownImageTokens: vi.fn(),
  persistDataUrlAttachment: vi.fn(async () => 'attachment://persisted.png'),
  saveSessionJson: vi.fn(async () => {}),
  loadSessionJson: vi.fn(async (): Promise<ChatMessage[] | null> => []),
  hasSessionJson: vi.fn(async () => false),
}))

vi.mock('@/components/Chat/common/messageImageTokens', () => ({
  parseMarkdownImageTokens: mocked.parseMarkdownImageTokens,
}))

vi.mock('@/lib/storage/attachmentStorage', () => ({
  persistDataUrlAttachment: mocked.persistDataUrlAttachment,
}))

vi.mock('@/lib/storage/chatStorage', () => ({
  cancelSessionJsonSave: vi.fn(),
  deleteSessionJson: vi.fn(async () => {}),
  hasSessionJson: mocked.hasSessionJson,
  loadSessionJson: mocked.loadSessionJson,
  saveSessionJson: mocked.saveSessionJson,
}))

function createMessage(id: string, content: string): ChatMessage {
  return {
    id,
    role: 'user',
    content,
    modelId: 'model-1',
    timestamp: 1,
    versions: [{
      content,
      createdAt: 1,
      kind: 'original',
      subsequentMessages: [],
    }],
    currentVersionIndex: 0,
  }
}

function seedSession(messages: ChatMessage[]) {
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
        sessions: [
          { id: 'session-1', title: 'First', modelId: 'model-1', createdAt: 1, updatedAt: 1 },
          { id: 'session-2', title: 'Second', modelId: 'model-1', createdAt: 2, updatedAt: 2 },
        ],
        messages: {
          'session-1': [],
          'session-2': messages,
        },
        unreadSessionIds: [],
        selectedModelId: 'model-1',
        currentSessionId: 'session-1',
        temporaryChatEnabled: false,
        customSystemPrompt: '',
        includeTimeContext: true,
      },
    },
    undoStack: [],
  })

  useAIUIStore.setState({
    generatingSessions: {},
    unreadSessions: {},
    error: null,
    currentSessionId: 'session-1',
    temporaryChatEnabled: false,
    selectionInitialized: true,
    temporaryReturnSessionId: null,
    authPromptSessionId: null,
  })
}

describe('session inline image persistence', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    mocked.persistDataUrlAttachment.mockResolvedValue('attachment://persisted.png')
    mocked.loadSessionJson.mockResolvedValue([])
    mocked.hasSessionJson.mockResolvedValue(false)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not parse ordinary long text while switching sessions', async () => {
    const { createSessionActions } = await import('./sessionActions')
    seedSession([createMessage('m1', 'plain text '.repeat(10_000))])

    await createSessionActions().switchSession('session-2')
    await vi.runOnlyPendingTimersAsync()

    expect(mocked.parseMarkdownImageTokens).not.toHaveBeenCalled()
    expect(mocked.persistDataUrlAttachment).not.toHaveBeenCalled()
  })

  it('persists inline data images found in markdown content', async () => {
    const source = 'data:image/png;base64,INLINE'
    mocked.parseMarkdownImageTokens.mockReturnValue([{
      start: 0,
      end: source.length,
      src: source,
    }])
    const { createSessionActions } = await import('./sessionActions')
    seedSession([createMessage('m1', `![image](<${source}>)\n\nDescribe`)])

    await createSessionActions().switchSession('session-2')
    await vi.runOnlyPendingTimersAsync()

    expect(mocked.parseMarkdownImageTokens).toHaveBeenCalledTimes(2)
    expect(mocked.persistDataUrlAttachment).toHaveBeenCalledWith(source)
    expect(useUnifiedStore.getState().data.ai?.messages['session-2']?.[0]?.content)
      .toBe('![image](<attachment://persisted.png>)\n\nDescribe')
  })

  it('limits unique inline data image persistence work per session switch', async () => {
    const sources = Array.from(
      { length: 1500 },
      (_, index) => `data:image/png;base64,${String(index).padStart(8, 'A')}`,
    )
    mocked.parseMarkdownImageTokens.mockReturnValue(
      sources.map((src, index) => ({
        start: index,
        end: index + src.length,
        src,
      })),
    )
    const { createSessionActions } = await import('./sessionActions')
    seedSession([createMessage('m1', `![image](<${sources[0]}>)`)])

    await createSessionActions().switchSession('session-2')
    await vi.runOnlyPendingTimersAsync()

    expect(mocked.persistDataUrlAttachment).toHaveBeenCalledTimes(1000)
    expect(mocked.persistDataUrlAttachment).toHaveBeenLastCalledWith(sources[999])
  })
})
