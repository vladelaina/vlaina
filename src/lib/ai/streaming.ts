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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function extractStreamText(value: unknown): string {
  if (typeof value === 'string') {
    return value
  }

  if (Array.isArray(value)) {
    return value.map((entry) => extractStreamText(entry)).join('')
  }

  if (!isRecord(value)) {
    return ''
  }

  if (typeof value.text === 'string') {
    return value.text
  }

  if (isRecord(value.text) && typeof value.text.value === 'string') {
    return value.text.value
  }

  if (typeof value.content === 'string') {
    return value.content
  }

  return ''
}

function extractErrorMessage(payload: Record<string, unknown>): string {
  const nestedError = payload.error
  if (isRecord(nestedError) && typeof nestedError.message === 'string') {
    return nestedError.message
  }

  return ''
}

function parsePayloadText(text: string): Record<string, unknown> | null {
  const trimmed = text.trim()
  if (!trimmed || trimmed === '[DONE]') {
    return null
  }

  const dataMatch = trimmed.match(/^data:\s*(.*)$/)
  const payloadText = dataMatch ? dataMatch[1] : trimmed
  if (!payloadText || payloadText === '[DONE]') {
    return null
  }

  try {
    return JSON.parse(payloadText) as Record<string, unknown>
  } catch {
    return null
  }
}

function extractStreamDelta(payload: Record<string, unknown>): StreamDeltaPayload {
  const choice = Array.isArray(payload.choices) ? payload.choices[0] : null
  if (!isRecord(choice)) {
    const output = isRecord(payload.output) ? payload.output : null
    const data = isRecord(payload.data) ? payload.data : null

    return {
      reasoning:
        extractStreamText(
          payload.reasoning_content ??
            payload.reasoning ??
            output?.reasoning_content ??
            output?.reasoning
        ) || null,
      content:
        extractStreamText(
          payload.output_text ??
            payload.response ??
            payload.result ??
            payload.message ??
            output?.text ??
            output?.content ??
            output?.message ??
            data?.content ??
            data?.text
        ) || null,
    }
  }

  const delta = isRecord(choice.delta) ? choice.delta : null
  const message = isRecord(choice.message) ? choice.message : null
  const source = delta ?? message
  if (!source) {
    return {}
  }

  return {
    reasoning: extractStreamText(source.reasoning_content ?? source.reasoning) || null,
    content: extractStreamText(source.content) || null,
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
    const payload = parsePayloadText(line)
    if (!payload) {
      return
    }

    const errorMessage = extractErrorMessage(payload)
    if (errorMessage) {
      throw new Error(errorMessage)
    }

    const delta = extractStreamDelta(payload)
    if (!delta.reasoning && !delta.content) {
      return
    }

    accumulator.pushDelta(delta)
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
