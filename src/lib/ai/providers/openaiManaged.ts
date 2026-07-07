import type { ChatCompletionRequest, ChatSendOptions } from '../types'
import {
  requestManagedChatCompletion,
  requestManagedChatCompletionStream,
  requestManagedImageEdit,
  requestManagedImageGeneration,
} from '@/lib/ai/managedService'
import { buildAssistantApiTranscriptFromRenderedContent } from './openaiRouting'
import { buildImageEditMultipartBody, normalizeGeneratedImageMarkdown } from './openaiImages'
import {
  createHtmlRejectingChunkHandler,
  emitApiTranscript,
  emitChunk,
  rejectHtmlErrorContent,
  throwIfAborted,
} from './openaiRuntime'

export function extractManagedResponseContent(payload: Record<string, unknown>): string {
  const choices = Array.isArray(payload.choices) ? payload.choices : []
  const firstChoice = choices[0]
  if (!firstChoice || typeof firstChoice !== 'object') return ''

  const message = (firstChoice as Record<string, unknown>).message
  if (!message || typeof message !== 'object') return ''

  const content = (message as Record<string, unknown>).content
  return typeof content === 'string' ? rejectHtmlErrorContent(content) : ''
}

export async function sendManagedMessage(
  body: ChatCompletionRequest,
  onChunk?: (chunk: string) => void,
  signal?: AbortSignal,
  options?: ChatSendOptions
): Promise<string> {
  if (body.stream === false) {
    const payload = await requestManagedChatCompletion({
      ...body,
      stream: false,
    } as unknown as Record<string, unknown>, signal)
    throwIfAborted(signal)
    const content = extractManagedResponseContent(payload)
    emitChunk(onChunk || (() => {}), signal, content)
    const apiTranscript = buildAssistantApiTranscriptFromRenderedContent(content)
    if (apiTranscript.length) {
      emitApiTranscript(options?.onApiTranscript, signal, apiTranscript)
    }
    return content
  }

  const content = await requestManagedChatCompletionStream(
    body as unknown as Record<string, unknown>,
    createHtmlRejectingChunkHandler(onChunk || (() => {}), signal),
    signal
  )
  throwIfAborted(signal)
  rejectHtmlErrorContent(content)
  const apiTranscript = buildAssistantApiTranscriptFromRenderedContent(content)
  if (apiTranscript.length) {
    emitApiTranscript(options?.onApiTranscript, signal, apiTranscript)
  }
  return content
}

export async function sendManagedImageGeneration(
  body: Record<string, unknown>,
  onChunk?: (chunk: string) => void,
  signal?: AbortSignal
): Promise<string> {
  const payload = await requestManagedImageGeneration(body, signal)
  throwIfAborted(signal)
  const content = normalizeGeneratedImageMarkdown(payload)
  emitChunk(onChunk || (() => {}), signal, content)
  return content
}

export async function sendManagedImageEdit(
  input: { imageUrl: string; model: string; prompt: string },
  onChunk?: (chunk: string) => void,
  signal?: AbortSignal
): Promise<string> {
  const { body, headers } = buildImageEditMultipartBody(input)
  const payload = await requestManagedImageEdit(body, headers, signal)
  throwIfAborted(signal)
  const content = normalizeGeneratedImageMarkdown(payload)
  emitChunk(onChunk || (() => {}), signal, content)
  return content
}
