export interface StreamDeltaPayload {
  reasoning?: string | null
  content?: string | null
}

export interface StreamAccumulator {
  pushDelta: (delta: StreamDeltaPayload) => void
  finish: () => string
}

export function createStreamAccumulator(onChunk: (chunk: string) => void): StreamAccumulator {
  let fullContent = ''
  let hasStartedReasoning = false
  let hasFinishedReasoning = false

  return {
    pushDelta(delta) {
      const reasoning = typeof delta.reasoning === 'string' ? delta.reasoning : ''
      const content = typeof delta.content === 'string' ? delta.content : ''

      if (!reasoning && !content) {
        return
      }

      if (reasoning) {
        if (!hasStartedReasoning) {
          fullContent += '<think>'
          hasStartedReasoning = true
        }
        fullContent += reasoning
      }

      if (content) {
        if (hasStartedReasoning && !hasFinishedReasoning) {
          fullContent += '</think>'
          hasFinishedReasoning = true
        }
        fullContent += content
      }

      onChunk(fullContent)
    },
    finish() {
      if (hasStartedReasoning && !hasFinishedReasoning) {
        fullContent += '</think>'
      }
      return fullContent
    },
  }
}

export async function consumeOpenAIStream(
  response: Response,
  onChunk: (chunk: string) => void
): Promise<string> {
  if (!response.body) {
    throw new Error('Response body is null')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  const accumulator = createStreamAccumulator(onChunk)
  let buffer = ''

  const consumeLine = (line: string) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed === 'data: [DONE]') {
      return
    }

    if (!trimmed.startsWith('data: ')) {
      return
    }

    try {
      const chunk = JSON.parse(trimmed.slice(6)) as {
        choices?: Array<{
          delta?: {
            reasoning_content?: string
            reasoning?: string
            content?: string
          }
        }>
      }
      const delta = chunk.choices?.[0]?.delta
      accumulator.pushDelta({
        reasoning:
          typeof delta?.reasoning_content === 'string'
            ? delta.reasoning_content
            : typeof delta?.reasoning === 'string'
              ? delta.reasoning
              : null,
        content: typeof delta?.content === 'string' ? delta.content : null,
      })
    } catch {}
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      consumeLine(line)
    }
  }

  if (buffer.trim()) {
    consumeLine(buffer)
  }

  return accumulator.finish()
}
