import { describe, expect, it } from 'vitest'

import {
  normalizeApiTranscriptMessage,
  normalizeApiTranscriptMessages,
} from './apiTranscript'

describe('apiTranscript normalization', () => {
  it('limits content parts per transcript message', () => {
    const content = Array.from({ length: 80 }, (_, index) => ({
      type: 'text',
      text: `part-${index}`,
    }))

    const message = normalizeApiTranscriptMessage({
      role: 'user',
      content,
    })

    expect(message?.content).toHaveLength(64)
    expect(Array.isArray(message?.content) ? message.content.at(-1) : null).toEqual({
      type: 'text',
      text: 'part-63',
    })
  })

  it('limits tool calls per transcript message', () => {
    const message = normalizeApiTranscriptMessage({
      role: 'assistant',
      content: '',
      tool_calls: Array.from({ length: 40 }, (_, index) => ({
        id: `call-${index}`,
        type: 'function',
        function: {
          name: 'web_search',
          arguments: `{"query":"${index}"}`,
        },
      })),
    })

    expect(message?.tool_calls).toHaveLength(32)
    expect(message?.tool_calls?.at(-1)?.id).toBe('call-31')
  })

  it('limits transcript messages from the newest entries', () => {
    const transcript = normalizeApiTranscriptMessages(
      Array.from({ length: 80 }, (_, index) => ({
        role: 'user',
        content: `message-${index}`,
      })),
    )

    expect(transcript).toHaveLength(64)
    expect(transcript?.[0]?.content).toBe('message-16')
    expect(transcript?.at(-1)?.content).toBe('message-79')
  })
})
