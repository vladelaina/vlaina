import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChatMessage } from '@/lib/ai/types'
import { useUnifiedStore } from '../unified/useUnifiedStore'
import { useAIUIStore } from './chatState'

const mocked = vi.hoisted(() => ({
  parseMarkdownAndHtmlImageTokens: vi.fn(),
  persistDataUrlAttachment: vi.fn(async () => 'attachment://persisted.png'),
  saveSessionJson: vi.fn(async () => {}),
  loadSessionJson: vi.fn(async (): Promise<ChatMessage[] | null> => []),
  hasSessionJson: vi.fn(async () => false),
}))

vi.mock('@/components/Chat/common/messageImageTokens', () => ({
  parseMarkdownAndHtmlImageTokens: mocked.parseMarkdownAndHtmlImageTokens,
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

    expect(mocked.parseMarkdownAndHtmlImageTokens).not.toHaveBeenCalled()
    expect(mocked.persistDataUrlAttachment).not.toHaveBeenCalled()
  })

  it('persists inline data images found in markdown content', async () => {
    const source = 'data:image/png;base64,INLINE'
    const plainText = `Plain ${source}`
    const imageMarkdown = `![image](<${source}>)`
    const content = `${plainText}\n\n${imageMarkdown}\n\nDescribe`
    const targetStart = content.lastIndexOf(source)
    mocked.parseMarkdownAndHtmlImageTokens.mockReturnValue([{
      start: content.indexOf(imageMarkdown),
      end: content.indexOf(imageMarkdown) + imageMarkdown.length,
      src: source,
      targetStart,
      targetEnd: targetStart + source.length,
    }])
    const { createSessionActions } = await import('./sessionActions')
    seedSession([createMessage('m1', content)])

    await createSessionActions().switchSession('session-2')
    await vi.runOnlyPendingTimersAsync()

    expect(mocked.parseMarkdownAndHtmlImageTokens).toHaveBeenCalledTimes(2)
    expect(mocked.persistDataUrlAttachment).toHaveBeenCalledWith(source)
    expect(useUnifiedStore.getState().data.ai?.messages['session-2']?.[0]?.content)
      .toBe(`${plainText}\n\n![image](<attachment://persisted.png>)\n\nDescribe`)
  })

  it('persists inline data images found in API transcript text parts', async () => {
    const source = 'data:image/png;base64,INLINE'
    const transcriptText = `Hidden text part ![image](<${source}>)`
    mocked.parseMarkdownAndHtmlImageTokens.mockImplementation((content: string) => {
      const targetStart = content.indexOf(source)
      return targetStart >= 0
        ? [{ start: 0, end: content.length, src: source, targetStart, targetEnd: targetStart + source.length }]
        : []
    })
    const message = {
      ...createMessage('m1', 'visible text'),
      apiTranscript: [{
        role: 'user',
        content: [
          { type: 'text' as const, text: transcriptText },
        ],
      }],
    }
    message.versions[0].apiTranscript = message.apiTranscript
    const { createSessionActions } = await import('./sessionActions')
    seedSession([message])

    await createSessionActions().switchSession('session-2')
    await vi.runOnlyPendingTimersAsync()

    const storedMessage = useUnifiedStore.getState().data.ai?.messages['session-2']?.[0]
    expect(mocked.persistDataUrlAttachment).toHaveBeenCalledWith(source)
    expect(storedMessage?.content).toBe('visible text')
    expect(storedMessage?.apiTranscript?.[0]?.content).toEqual([
      { type: 'text', text: 'Hidden text part ![image](<attachment://persisted.png>)' },
    ])
    expect(storedMessage?.versions[0]?.apiTranscript?.[0]?.content).toEqual([
      { type: 'text', text: 'Hidden text part ![image](<attachment://persisted.png>)' },
    ])
  })

  it('limits unique inline data image persistence work per session switch', async () => {
    const sources = Array.from(
      { length: 1500 },
      (_, index) => `data:image/png;base64,${String(index).padStart(8, 'A')}`,
    )
    mocked.parseMarkdownAndHtmlImageTokens.mockReturnValue(
      sources.map((src, index) => ({
        start: index,
        end: index + src.length,
        src,
        targetStart: index,
        targetEnd: index + src.length,
      })),
    )
    const { createSessionActions } = await import('./sessionActions')
    seedSession([createMessage('m1', `![image](<${sources[0]}>)`)])

    await createSessionActions().switchSession('session-2')
    await vi.runOnlyPendingTimersAsync()

    expect(mocked.persistDataUrlAttachment).toHaveBeenCalledTimes(1000)
    expect(mocked.persistDataUrlAttachment).toHaveBeenLastCalledWith(sources[999])
  })

  it('does not rescan plain message text while replacing cached inline image sources', async () => {
    const source = 'data:image/png;base64,INLINE'
    const message = {
      ...createMessage('m1', 'plain text '.repeat(10_000)),
      imageSources: [source],
    }
    const { createSessionActions } = await import('./sessionActions')
    seedSession([message])
    const splitSpy = vi.spyOn(String.prototype, 'split')

    try {
      await createSessionActions().switchSession('session-2')
      await vi.runOnlyPendingTimersAsync()

      expect(mocked.persistDataUrlAttachment).toHaveBeenCalledWith(source)
      expect(useUnifiedStore.getState().data.ai?.messages['session-2']?.[0]?.content).toBe(message.content)
      expect(useUnifiedStore.getState().data.ai?.messages['session-2']?.[0]?.imageSources).toEqual([
        'attachment://persisted.png',
      ])
      expect(splitSpy).not.toHaveBeenCalled()
    } finally {
      splitSpy.mockRestore()
    }
  })

  it('bounds inline image replacement to the scanned branch depth', async () => {
    const source = 'data:image/png;base64,INLINE'
    mocked.parseMarkdownAndHtmlImageTokens.mockImplementation((content: string) => {
      const targetStart = content.indexOf(source)
      return targetStart >= 0
        ? [{ start: 0, end: content.length, src: source, targetStart, targetEnd: targetStart + source.length }]
        : []
    }
    )
    const rootMessage = createMessage('m1', `root ![image](<${source}>)`)
    rootMessage.versions[0].subsequentMessages = [
      {
        ...createMessage('branch-1', `branch ![image](<${source}>)`),
        versions: [{
          content: `branch version ![image](<${source}>)`,
          createdAt: 1,
          kind: 'original',
          subsequentMessages: [
            createMessage('branch-2', `deep branch ![image](<${source}>)`),
          ],
        }],
      },
    ]

    const { createSessionActions } = await import('./sessionActions')
    seedSession([rootMessage])

    await createSessionActions().switchSession('session-2')
    await vi.runOnlyPendingTimersAsync()

    const message = useUnifiedStore.getState().data.ai?.messages['session-2']?.[0]
    const branch = message?.versions[0]?.subsequentMessages[0]
    const deepBranch = branch?.versions[0]?.subsequentMessages[0]

    expect(mocked.persistDataUrlAttachment).toHaveBeenCalledWith(source)
    expect(message?.content).toBe('root ![image](<attachment://persisted.png>)')
    expect(branch?.content).toBe('branch ![image](<attachment://persisted.png>)')
    expect(branch?.versions[0]?.content).toBe('branch version ![image](<attachment://persisted.png>)')
    expect(deepBranch?.content).toBe(`deep branch ![image](<${source}>)`)
  })
})
