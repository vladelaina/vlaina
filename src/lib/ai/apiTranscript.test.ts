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

  it('drops unsafe image URLs from transcript content parts', () => {
    const message = normalizeApiTranscriptMessage({
      role: 'user',
      content: [
        { type: 'text', text: 'inspect these images' },
        { type: 'image_url', image_url: { url: 'https://example.com/safe.png', detail: 'low' } },
        { type: 'image_url', image_url: { url: 'http://127.0.0.1:3000/secret.png', detail: 'high' } },
        { type: 'image_url', image_url: { url: 'file:///tmp/secret.png' } },
        { type: 'image_url', image_url: { url: 'attachment://safe.png' } },
        { type: 'image_url', image_url: { url: 'data:image/svg+xml;base64,PHN2Zz4=' } },
        { type: 'image_url', image_url: { url: 'data:image/png;base64,aGk=' } },
      ],
    })

    expect(message?.content).toEqual([
      { type: 'text', text: 'inspect these images' },
      { type: 'image_url', image_url: { url: 'https://example.com/safe.png', detail: 'low' } },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,aGk=' } },
    ])
  })

  it('uses empty content when a required transcript message contains only unsafe images', () => {
    const message = normalizeApiTranscriptMessage({
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: 'http://192.168.1.5/secret.png' } },
      ],
    })

    expect(message).toEqual({ role: 'user', content: '' })
  })
})
