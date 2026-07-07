import { stringifyProviderJsonRequestBody } from '@/lib/ai/providerRequestBody'
import { consumeOpenAIStream } from '@/lib/ai/streaming'
import { addChatDebugLog } from '@/lib/debug/chatDebugLog'
import { parseHTTPError } from '../errors'
import { providerFetch } from '../providerHttp'
import type { ChatCompletionRequest, ChatSendOptions } from '../types'
import { buildImageEditMultipartBody, normalizeGeneratedImageMarkdown } from './openaiImages'
import {
  createAbortError,
  createHtmlRejectingChunkHandler,
  emitApiTranscript,
  emitChunk,
  hasHttpStatus,
  isAbortError,
  isTransientHttpStatus,
  readResponseJson,
  readResponseTextOrFallback,
  rejectHtmlErrorContent,
  summarizeError,
  throwIfAborted,
  throwParsedOpenAIError,
  waitForProviderRetry,
} from './openaiRuntime'

export async function requestOpenAIChatCompletionWithRetry({
  url,
  headers,
  body,
  signal,
  scope,
  retryDelayMs,
}: {
  url: string
  headers: Record<string, string>
  body: ChatCompletionRequest
  signal?: AbortSignal
  scope: string
  retryDelayMs: number
}): Promise<Response> {
  let lastError: unknown

  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (attempt > 0) {
      addChatDebugLog(scope, 'retrying transient model request', { attempt })
      await waitForProviderRetry(retryDelayMs, signal)
    }

    try {
      const response = await providerFetch(url, {
        method: 'POST',
        headers,
        body: stringifyProviderJsonRequestBody(body),
        signal,
      })
      if (response.ok) return response

      const errorText = await readResponseTextOrFallback(response, signal)
      let errorBody
      try {
        errorBody = JSON.parse(errorText)
      } catch {
        errorBody = { message: errorText }
      }
      const parsedError = parseHTTPError(response.status, errorBody)
      if (attempt === 0 && isTransientHttpStatus(response.status)) {
        lastError = parsedError
        addChatDebugLog(scope, 'transient model request failed before response body stream', {
          status: response.status,
        }, 'warn')
        continue
      }
      throw parsedError
    } catch (error) {
      if (signal?.aborted) throw error
      if (hasHttpStatus(error)) throw error
      if (attempt === 0) {
        lastError = error
        addChatDebugLog(scope, 'model request failed before response body stream', {
          error: summarizeError(error),
        }, 'warn')
        continue
      }
      throw error
    }
  }

  throw lastError
}

export async function sendImageGeneration(
  url: string,
  headers: Record<string, string>,
  body: Record<string, unknown>,
  onChunk: (chunk: string) => void,
  signal?: AbortSignal
): Promise<string> {
  throwIfAborted(signal)
  const response = await providerFetch(url, {
    method: 'POST',
    headers,
    body: stringifyProviderJsonRequestBody(body),
    signal,
  })

  if (!response.ok) {
    const errorText = await readResponseTextOrFallback(response, signal)
    let errorBody
    try {
      errorBody = JSON.parse(errorText)
    } catch {
      errorBody = { message: errorText }
    }
    throw parseHTTPError(response.status, errorBody)
  }

  const payload = await readResponseJson<Record<string, unknown>>(response, signal)
  throwIfAborted(signal)
  const content = normalizeGeneratedImageMarkdown(payload)
  emitChunk(onChunk, signal, content)
  return content
}

export async function sendImageEdit(
  url: string,
  headers: Record<string, string>,
  input: { imageUrl: string; model: string; prompt: string },
  onChunk: (chunk: string) => void,
  signal?: AbortSignal
): Promise<string> {
  throwIfAborted(signal)
  const multipart = buildImageEditMultipartBody(input)
  const response = await providerFetch(url, {
    method: 'POST',
    headers: {
      Authorization: headers.Authorization,
      ...multipart.headers,
    },
    body: multipart.body,
    signal,
  })

  if (!response.ok) {
    const errorText = await readResponseTextOrFallback(response, signal)
    let errorBody
    try {
      errorBody = JSON.parse(errorText)
    } catch {
      errorBody = { message: errorText }
    }
    throw parseHTTPError(response.status, errorBody)
  }

  const payload = await readResponseJson<Record<string, unknown>>(response, signal)
  throwIfAborted(signal)
  const content = normalizeGeneratedImageMarkdown(payload)
  emitChunk(onChunk, signal, content)
  return content
}

export async function streamResponse({
  url,
  headers,
  body,
  onChunk,
  signal,
  options,
  timeoutMs,
}: {
  url: string
  headers: Record<string, string>
  body: ChatCompletionRequest
  onChunk: (chunk: string) => void
  signal?: AbortSignal
  options?: ChatSendOptions
  timeoutMs: number
}): Promise<string> {
  const controller = new AbortController()
  let timedOut = false
  const timeoutId = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)

  const forwardAbort = () => {
    if (!controller.signal.aborted) controller.abort()
  }
  signal?.addEventListener('abort', forwardAbort, { once: true })
  if (signal?.aborted) forwardAbort()

  try {
    if (controller.signal.aborted) throw createAbortError()

    const response = await providerFetch(url, {
      method: 'POST',
      headers,
      body: stringifyProviderJsonRequestBody(body),
      signal: controller.signal,
    })

    if (!response.ok) {
      const errorText = await readResponseTextOrFallback(response, controller.signal)
      let errorBody
      try {
        errorBody = JSON.parse(errorText)
      } catch {
        errorBody = { message: errorText }
      }
      throw parseHTTPError(response.status, errorBody)
    }

    const result = await consumeOpenAIStream(response, createHtmlRejectingChunkHandler(onChunk, controller.signal), {
      signal: controller.signal,
      onAssistantTranscriptMessage: (message) => {
        emitApiTranscript(options?.onApiTranscript, controller.signal, [message])
      },
    })
    throwIfAborted(controller.signal)
    return rejectHtmlErrorContent(result)
  } catch (error) {
    if (isAbortError(error) && (timedOut || signal?.aborted)) {
      if (timedOut) throw new Error('The AI request timed out.')
      throw error
    }
    return throwParsedOpenAIError(error, url)
  } finally {
    clearTimeout(timeoutId)
    signal?.removeEventListener('abort', forwardAbort)
  }
}
