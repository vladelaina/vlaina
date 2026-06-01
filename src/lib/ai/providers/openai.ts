import type { AIClient } from '../client'
import type { ApiTranscriptMessage, Provider, AIModel, ChatCompletionRequest, ChatMessage, ChatMessageContent, ChatSendOptions } from '../types'
import { createAIError, parseAPIError, parseHTTPError } from '../errors'
import { AIErrorType } from '../types'
import { buildOpenAIBaseUrl, resolveApiModelId } from '../utils'
import { sendAnthropicMessage } from './anthropic'
import { detectProviderEndpointModels, type ModelFetchResult } from './modelDetection'
import { providerFetch } from '../providerHttp'
import {
  fetchManagedModels,
  MANAGED_PROVIDER_ID,
  requestManagedChatCompletion,
  requestManagedChatCompletionStream,
  requestManagedImageEdit,
  requestManagedImageGeneration,
} from '@/lib/ai/managedService'
import { consumeOpenAIStream } from '@/lib/ai/streaming'
import { normalizeApiTranscriptMessage } from '@/lib/ai/apiTranscript'
import { stripThinkingContent } from '@/lib/ai/stripThinkingContent'
import {
  runOpenAIWebSearchTextProtocolRequest,
  runOpenAIWebSearchTextProtocolTextRequest,
  runOpenAIWebSearchJsonToolLoop,
  runOpenAIWebSearchToolLoop,
} from '@/lib/ai/webSearch/openAIToolLoop'
import { buildWebSearchStatusMarkup, stripWebSearchStatusMarkup } from '@/lib/ai/webSearch/statusMarkup'
import { isStandaloneImageGenerationModel } from '@/lib/ai/modelCapabilities'
import { addChatDebugLog } from '@/lib/debug/chatDebugLog'

function summarizeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error || 'Unknown error')
}

function isLikelyHtmlErrorContent(content: string): boolean {
  const normalized = content.slice(0, 2000).trim().toLowerCase()
  const hasCloudflareErrorShell =
    normalized.includes('cloudflare') &&
    (normalized.includes('error code') ||
      normalized.includes('cf-wrapper') ||
      normalized.includes('performance & security by'))
  return (
    normalized.startsWith('<!doctype html') ||
    normalized.startsWith('<html') ||
    normalized.includes('<title>') ||
    hasCloudflareErrorShell ||
    normalized.includes('error code 524')
  )
}

function rejectHtmlErrorContent(content: string): string {
  if (isLikelyHtmlErrorContent(content)) {
    throw createAIError(AIErrorType.SERVER_ERROR, 'UPSTREAM_UNAVAILABLE')
  }
  return content
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
    || !!error && typeof error === 'object' && (error as { name?: unknown }).name === 'AbortError'
}

function createAbortError(): DOMException {
  return new DOMException('Aborted', 'AbortError')
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return
  throw createAbortError()
}

function emitChunk(onChunk: (chunk: string) => void, signal: AbortSignal | undefined, chunk: string): void {
  throwIfAborted(signal)
  onChunk(chunk)
  throwIfAborted(signal)
}

function emitApiTranscript(
  onApiTranscript: ChatSendOptions['onApiTranscript'] | undefined,
  signal: AbortSignal | undefined,
  messages: ApiTranscriptMessage[]
): void {
  throwIfAborted(signal)
  onApiTranscript?.(messages)
  throwIfAborted(signal)
}

function emitWebSearchStatus(
  onWebSearchStatus: ChatSendOptions['onWebSearchStatus'] | undefined,
  signal: AbortSignal | undefined,
  status: Parameters<NonNullable<ChatSendOptions['onWebSearchStatus']>>[0]
): void {
  throwIfAborted(signal)
  onWebSearchStatus?.(status)
  throwIfAborted(signal)
}

function createHtmlRejectingChunkHandler(onChunk: (chunk: string) => void, signal?: AbortSignal): (chunk: string) => void {
  return (chunk) => {
    rejectHtmlErrorContent(chunk)
    emitChunk(onChunk, signal, chunk)
  }
}

async function raceWithAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return await promise
  throwIfAborted(signal)
  promise.catch(() => undefined)

  return await new Promise<T>((resolve, reject) => {
    let settled = false
    const cleanup = () => {
      signal.removeEventListener('abort', abort)
    }
    const settle = (callback: () => void) => {
      if (settled) return
      settled = true
      cleanup()
      callback()
    }
    const abort = () => {
      settle(() => reject(createAbortError()))
    }

    signal.addEventListener('abort', abort, { once: true })
    if (signal.aborted) {
      abort()
      return
    }

    promise.then(
      (value) => {
        settle(() => {
          try {
            throwIfAborted(signal)
            resolve(value)
          } catch (error) {
            reject(error)
          }
        })
      },
      (error) => {
        settle(() => {
          try {
            throwIfAborted(signal)
            reject(error)
          } catch (abortError) {
            reject(abortError)
          }
        })
      },
    )
  })
}

async function readResponseTextOrFallback(response: Response, signal?: AbortSignal): Promise<string> {
  try {
    throwIfAborted(signal)
    return await raceWithAbort(response.text(), signal)
  } catch {
    if (signal?.aborted) {
      throw createAbortError()
    }
    return 'Unknown error'
  }
}

async function readResponseJson<T>(response: Response, signal?: AbortSignal): Promise<T> {
  throwIfAborted(signal)
  return await raceWithAbort(response.json() as Promise<T>, signal)
}

function createUnsupportedWebSearchError(): Error {
  return new Error('Web search is unavailable for this model.')
}

function isTransientHttpStatus(status: number): boolean {
  return status === 408 || status === 500 || status === 502 || status === 503 || status === 504
}

function waitForProviderRetry(delayMs: number, signal?: AbortSignal): Promise<void> {
  if (delayMs <= 0) return Promise.resolve()
  if (signal?.aborted) {
    return Promise.reject(new DOMException('Aborted', 'AbortError'))
  }

  return new Promise((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout>
    const abort = () => {
      clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    const finish = () => {
      signal?.removeEventListener('abort', abort)
      resolve()
    }

    signal?.addEventListener('abort', abort, { once: true })
    timer = setTimeout(finish, delayMs)
  })
}

function hasHttpStatus(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  return typeof (error as { statusCode?: unknown }).statusCode === 'number'
    || typeof (error as { status?: unknown }).status === 'number'
}

function isDeepSeekOpenAICompatible(provider: Provider, model: AIModel): boolean {
  const haystack = [
    provider.name,
    provider.apiHost,
    model.name,
    model.apiModelId,
  ].join(' ').toLowerCase()
  return haystack.includes('deepseek')
}

function isClaudeModel(provider: Provider, model: AIModel): boolean {
  const haystack = [
    provider.id,
    provider.name,
    provider.apiHost,
    model.name,
    model.apiModelId,
  ].join(' ').toLowerCase()
  return haystack.includes('claude') || haystack.includes('anthropic')
}

function isMoonshotModel(provider: Provider, model: AIModel): boolean {
  const haystack = [
    provider.id,
    provider.name,
    provider.apiHost,
    model.id,
    model.providerId,
    model.name,
    model.apiModelId,
  ].join(' ').toLowerCase()
  return haystack.includes('moonshot') || haystack.includes('kimi')
}

function shouldUseWebSearchTextProtocol(provider: Provider, model: AIModel): boolean {
  return isClaudeModel(provider, model) || isMoonshotModel(provider, model)
}

function shouldReplayApiTranscript(provider: Provider, model: AIModel): boolean {
  return provider.endpointType !== 'anthropic' && isDeepSeekOpenAICompatible(provider, model)
}

function isGrokModel(provider: Provider, model: AIModel): boolean {
  const haystack = [
    provider.id,
    provider.name,
    provider.apiHost,
    model.id,
    model.providerId,
    model.name,
    model.apiModelId,
  ].join(' ').toLowerCase()
  return /(^|[\s._:/-])grok(?:[\s._:/-]|\d|$)/i.test(haystack) ||
    /(^|[\s._:/-])x[\s._-]?ai(?:[\s._:/-]|$)/i.test(haystack)
}

function isOfficialXaiProvider(provider: Provider): boolean {
  try {
    const hostname = new URL(provider.apiHost).hostname.toLowerCase()
    return hostname === 'api.x.ai' || hostname.endsWith('.x.ai')
  } catch {
    return provider.apiHost.toLowerCase().includes('api.x.ai')
  }
}

function shouldUseXaiNativeWebSearch(provider: Provider, model: AIModel): boolean {
  if (!isOfficialXaiProvider(provider)) {
    return false
  }
  return isGrokModel(provider, model)
}

function buildChatCompletionOptions(options?: ChatSendOptions): Partial<ChatCompletionRequest> {
  return {
    ...(typeof options?.max_tokens === 'number' ? { max_tokens: options.max_tokens } : {}),
    ...(typeof options?.max_completion_tokens === 'number' ? { max_completion_tokens: options.max_completion_tokens } : {}),
  }
}

function extractTextPrompt(content: ChatMessageContent): string {
  if (typeof content === 'string') {
    return content.trim()
  }

  return content
    .filter((part): part is Extract<typeof part, { type: 'text' }> => part.type === 'text')
    .map((part) => part.text.trim())
    .filter(Boolean)
    .join('\n\n')
    .trim()
}

function getFirstImageInput(content: ChatMessageContent): string | null {
  if (!Array.isArray(content)) {
    return null;
  }

  const imagePart = content.find((part) => part.type === 'image_url');
  return imagePart?.type === 'image_url' ? imagePart.image_url.url.trim() || null : null;
}

function parseDataImageUrl(value: string): { bytes: Uint8Array; mimeType: string } | null {
  const match = /^data:(image\/(?:png|jpeg|jpg|webp));base64,([A-Za-z0-9+/=]+)$/i.exec(value.trim());
  if (!match) {
    return null;
  }

  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return { bytes, mimeType: match[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : match[1].toLowerCase() };
}

function extensionForMimeType(mimeType: string): string {
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/webp') return 'webp';
  return 'png';
}

function escapeMultipartValue(value: string): string {
  return value.replace(/"/g, '%22').replace(/\r|\n/g, ' ');
}

function buildImageEditMultipartBody({
  model,
  prompt,
  imageUrl,
}: {
  imageUrl: string;
  model: string;
  prompt: string;
}): { body: Blob; headers: Record<string, string> } {
  const parsedImage = parseDataImageUrl(imageUrl);
  if (!parsedImage) {
    throw new Error('Image edits require a PNG, JPEG, or WebP image attachment.');
  }

  const boundary = `----image-edit-${crypto.randomUUID()}`;
  const chunks: Array<string | Uint8Array> = [];
  const appendField = (name: string, value: string) => {
    chunks.push(
      `--${boundary}\r\n`,
      `Content-Disposition: form-data; name="${escapeMultipartValue(name)}"\r\n\r\n`,
      value,
      '\r\n',
    );
  };
  const appendFile = (name: string, filename: string, mimeType: string, bytes: Uint8Array) => {
    chunks.push(
      `--${boundary}\r\n`,
      `Content-Disposition: form-data; name="${escapeMultipartValue(name)}"; filename="${escapeMultipartValue(filename)}"\r\n`,
      `Content-Type: ${mimeType}\r\n\r\n`,
      bytes,
      '\r\n',
    );
  };

  appendField('model', model);
  appendField('prompt', prompt);
  appendField('n', '1');
  appendFile('image', `image.${extensionForMimeType(parsedImage.mimeType)}`, parsedImage.mimeType, parsedImage.bytes);
  chunks.push(`--${boundary}--\r\n`);

  return {
    body: new Blob(chunks),
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
  };
}

function normalizeGeneratedImageAlt(value: unknown, index: number): string {
  if (typeof value !== 'string') {
    return `Generated image ${index + 1}`
  }

  const normalized = value
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || `Generated image ${index + 1}`
}

function escapeMarkdownImageAlt(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/]/g, '\\]')
}

function escapeMarkdownAngleTarget(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f\s<>]+/g, '')
}

function normalizeGeneratedImageMarkdown(payload: Record<string, unknown>): string {
  const data = Array.isArray(payload.data) ? payload.data : []
  const markdown = data.flatMap((item, index) => {
    if (!item || typeof item !== 'object') {
      return []
    }
    const record = item as Record<string, unknown>
    const url = typeof record.url === 'string' && record.url.trim()
      ? record.url.trim()
      : typeof record.b64_json === 'string' && record.b64_json.trim()
        ? `data:image/png;base64,${record.b64_json.trim()}`
        : ''
    const safeTarget = escapeMarkdownAngleTarget(url)
    return safeTarget
      ? [`![${escapeMarkdownImageAlt(normalizeGeneratedImageAlt(record.revised_prompt, index))}](<${safeTarget}>)`]
      : []
  })

  return markdown.join('\n\n')
}

function buildAssistantApiTranscriptFromRenderedContent(content: string): ApiTranscriptMessage[] {
  const reasoningParts = Array.from(content.matchAll(/<think>([\s\S]*?)(?:<\/think>|$)/gi))
    .map((match) => match[1] ?? '')
    .filter(Boolean)

  if (reasoningParts.length === 0) {
    return []
  }

  const assistantContent = content.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '')
  return [{
    role: 'assistant',
    content: assistantContent,
    reasoning_content: reasoningParts.join('\n\n'),
  }]
}

function stripRenderedThinkingFromAssistantContent(content: ChatMessageContent): ChatMessageContent {
  if (typeof content === 'string') {
    return stripWebSearchStatusMarkup(stripThinkingContent(content))
  }

  return content.map((part) => {
    if (part.type !== 'text') {
      return part
    }
    return {
      ...part,
      text: stripWebSearchStatusMarkup(stripThinkingContent(part.text)),
    }
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function isSafeHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function textFromResponseContent(value: unknown): string {
  if (typeof value === 'string') {
    return value
  }
  if (!Array.isArray(value)) {
    return ''
  }
  return value.map((part) => {
    if (typeof part === 'string') return part
    if (!isRecord(part)) return ''
    if (typeof part.text === 'string') return part.text
    if (typeof part.content === 'string') return part.content
    return ''
  }).join('')
}

function extractXaiResponsesText(payload: Record<string, unknown>): string {
  if (typeof payload.output_text === 'string') {
    return payload.output_text
  }

  const output = Array.isArray(payload.output) ? payload.output : []
  const parts: string[] = []
  for (const item of output) {
    if (!isRecord(item)) continue
    if (typeof item.content === 'string') {
      parts.push(item.content)
      continue
    }
    if (!Array.isArray(item.content)) continue
    for (const content of item.content) {
      if (!isRecord(content)) continue
      if (content.type === 'output_text' && typeof content.text === 'string') {
        parts.push(content.text)
      }
    }
  }
  return parts.join('')
}

function collectXaiCitationUrlsFromValue(value: unknown, urls: string[]): void {
  if (isSafeHttpUrl(value)) {
    if (!urls.includes(value)) urls.push(value)
    return
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectXaiCitationUrlsFromValue(item, urls)
    }
    return
  }
  if (!isRecord(value)) {
    return
  }
  if (isSafeHttpUrl(value.url) && !urls.includes(value.url)) {
    urls.push(value.url)
  }
  for (const key of ['citations', 'citation', 'annotations', 'inline_citations', 'url_citation', 'source', 'sources', 'content', 'output']) {
    if (key in value) {
      collectXaiCitationUrlsFromValue(value[key], urls)
    }
  }
}

function extractXaiCitationUrls(payload: Record<string, unknown>): string[] {
  const urls: string[] = []
  collectXaiCitationUrlsFromValue(payload.citations, urls)
  collectXaiCitationUrlsFromValue(payload.inline_citations, urls)
  collectXaiCitationUrlsFromValue(payload.output, urls)
  return urls.slice(0, 8)
}

function buildXaiResponsesInput(messages: ApiTranscriptMessage[]): Array<Record<string, unknown>> {
  return messages
    .filter((message) => message.role === 'system' || message.role === 'user' || message.role === 'assistant')
    .map((message) => ({
      role: message.role,
      content: textFromResponseContent(message.content),
    }))
    .filter((message) => typeof message.content === 'string' && message.content.trim().length > 0)
}

export class OpenAICompatibleClient implements AIClient {
  private readonly timeout = 300000
  private readonly webSearchRequestRetryDelayMs = 700

  private extractManagedResponseContent(payload: Record<string, unknown>): string {
    const choices = Array.isArray(payload.choices) ? payload.choices : []
    const firstChoice = choices[0]
    if (!firstChoice || typeof firstChoice !== 'object') return ''

    const message = (firstChoice as Record<string, unknown>).message
    if (!message || typeof message !== 'object') return ''

    const content = (message as Record<string, unknown>).content
    return typeof content === 'string' ? rejectHtmlErrorContent(content) : ''
  }

  private buildChatRequest(
    message: ChatMessageContent,
    history: ChatMessage[],
    model: AIModel,
    provider: Provider,
    options?: ChatSendOptions
  ): ChatCompletionRequest {
    const replayApiTranscript = shouldReplayApiTranscript(provider, model)
    const apiMessages: ApiTranscriptMessage[] = history.flatMap((entry) => {
      const transcript = entry.apiTranscript ?? entry.versions?.[entry.currentVersionIndex]?.apiTranscript
      if (replayApiTranscript && entry.role === 'assistant' && transcript?.length) {
        const normalizedTranscript = transcript
          .map(normalizeApiTranscriptMessage)
          .filter((message): message is ApiTranscriptMessage => message !== null)
        if (normalizedTranscript.length > 0) {
          return normalizedTranscript
        }
      }
      return [{
        role: entry.role,
        content: entry.role === 'assistant'
          ? stripRenderedThinkingFromAssistantContent(entry.content)
          : entry.content,
      }]
    })
    apiMessages.push({ role: 'user', content: message })

    return {
      model: resolveApiModelId(model),
      messages: apiMessages,
      stream: true,
      ...buildChatCompletionOptions(options),
    }
  }

  private async sendManagedMessage(
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
      const content = this.extractManagedResponseContent(payload)
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

  private async sendManagedImageGeneration(
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

  private async resolveApiKey(provider: Provider): Promise<string> {
    const directApiKey = provider.apiKey?.trim() || ''
    if (!directApiKey) {
      throw new Error('Missing API key')
    }
    return directApiKey
  }

  private async requestOpenAIChatCompletionWithRetry({
    url,
    headers,
    body,
    signal,
    scope,
  }: {
    url: string
    headers: Record<string, string>
    body: ChatCompletionRequest
    signal?: AbortSignal
    scope: string
  }): Promise<Response> {
    let lastError: unknown

    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (attempt > 0) {
        addChatDebugLog(scope, 'retrying transient model request', { attempt })
        await waitForProviderRetry(this.webSearchRequestRetryDelayMs, signal)
      }

      try {
        const response = await providerFetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal,
        })
        if (response.ok) {
          return response
        }

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
        if (signal?.aborted) {
          throw error
        }
        if (hasHttpStatus(error)) {
          throw error
        }
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

  private async sendXaiNativeWebSearchMessage({
    baseUrl,
    headers,
    body,
    onChunk,
    signal,
    options,
  }: {
    baseUrl: string
    headers: Record<string, string>
    body: ChatCompletionRequest
    onChunk: (chunk: string) => void
    signal?: AbortSignal
    options?: ChatSendOptions
  }): Promise<string> {
    throwIfAborted(signal)
    emitWebSearchStatus(
      options?.onWebSearchStatus,
      signal,
      { phase: 'searching', query: extractTextPrompt(body.messages[body.messages.length - 1]?.content ?? '') }
    )
    emitChunk(onChunk, signal, buildWebSearchStatusMarkup({ phase: 'searching' }))

    const response = await providerFetch(`${baseUrl}/responses`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: body.model,
        input: buildXaiResponsesInput(body.messages),
        tools: [{ type: 'web_search' }],
        ...buildChatCompletionOptions(options),
      }),
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
    const content = rejectHtmlErrorContent(extractXaiResponsesText(payload))
    if (!content.trim()) {
      throw new Error('The model completed web search but returned no visible answer.')
    }
    const citationUrls = extractXaiCitationUrls(payload)
    const statuses = citationUrls.length > 0
      ? [
          buildWebSearchStatusMarkup({
            phase: 'results',
            results: citationUrls.slice(0, 5).map((url) => ({
              title: hostLabel(url),
              url,
              snippet: '',
              publishedAt: null,
            })),
            metrics: { resultCount: citationUrls.length },
          }),
          buildWebSearchStatusMarkup({
            phase: 'complete',
            urls: citationUrls,
            metrics: { successCount: citationUrls.length },
          }),
        ].join('')
      : ''
    const finalContent = `${statuses}${statuses && content.trim() ? '\n\n' : ''}${content}`
    if (citationUrls.length > 0) {
      emitWebSearchStatus(options?.onWebSearchStatus, signal, {
        phase: 'results',
        results: citationUrls.slice(0, 5).map((url) => ({
          title: hostLabel(url),
          url,
          snippet: '',
          publishedAt: null,
        })),
        metrics: { resultCount: citationUrls.length },
      })
      emitWebSearchStatus(options?.onWebSearchStatus, signal, {
        phase: 'complete',
        urls: citationUrls,
        metrics: { successCount: citationUrls.length },
      })
    }
    emitChunk(onChunk, signal, finalContent)
    emitApiTranscript(options?.onApiTranscript, signal, [{ role: 'assistant', content }])
    return finalContent
  }

  async sendMessage(
    message: ChatMessageContent,
    history: ChatMessage[],
    model: AIModel,
    provider: Provider,
    onChunk?: (chunk: string) => void,
    signal?: AbortSignal,
    options?: ChatSendOptions
  ): Promise<string> {
    const body = this.buildChatRequest(message, history, model, provider, options)
    const isImageModel = isStandaloneImageGenerationModel(model)
    const imagePrompt = isImageModel ? extractTextPrompt(message) : ''

    const editImageUrl = isImageModel ? getFirstImageInput(message) : null

    if (provider.id === MANAGED_PROVIDER_ID) {
      if (isImageModel && editImageUrl) {
        return this.sendManagedImageEdit({
          model: resolveApiModelId(model),
          prompt: imagePrompt,
          imageUrl: editImageUrl,
        }, onChunk, signal)
      }
      if (isImageModel) {
        return this.sendManagedImageGeneration({
          model: resolveApiModelId(model),
          prompt: imagePrompt,
          n: 1,
        }, onChunk, signal)
      }
      if (options?.webSearchEnabled && !isGrokModel(provider, model)) {
        if (shouldUseWebSearchTextProtocol(provider, model)) {
          return runOpenAIWebSearchTextProtocolTextRequest({
            body,
            onChunk: onChunk || (() => {}),
            onStatus: options.onWebSearchStatus,
            onApiTranscript: options.onApiTranscript,
            signal,
            requestText: (nextBody, nextOnChunk) =>
              requestManagedChatCompletionStream({
                ...nextBody,
                stream: true,
              } as unknown as Record<string, unknown>, createHtmlRejectingChunkHandler(nextOnChunk), signal),
          })
        }
        return runOpenAIWebSearchJsonToolLoop({
          body,
          onChunk: onChunk || (() => {}),
          onStatus: options.onWebSearchStatus,
          onApiTranscript: options.onApiTranscript,
          signal,
          autoReadAfterSearch: true,
          requestJson: (nextBody) =>
            requestManagedChatCompletion({
              ...nextBody,
              stream: false,
            } as unknown as Record<string, unknown>, signal),
        })
      }
      return this.sendManagedMessage(body, onChunk, signal, options)
    }

    const apiKey = await this.resolveApiKey(provider)
    const baseUrl = buildOpenAIBaseUrl(provider.apiHost)
    const headers = {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    }

    if (isImageModel) {
      if (editImageUrl) {
        return this.sendImageEdit(
          `${baseUrl}/images/edits`,
          headers,
          {
            model: resolveApiModelId(model),
            prompt: imagePrompt,
            imageUrl: editImageUrl,
          },
          onChunk || (() => {}),
          signal,
        )
      }
      return this.sendImageGeneration(
        `${baseUrl}/images/generations`,
        headers,
        {
          model: resolveApiModelId(model),
          prompt: imagePrompt,
          n: 1,
        },
        onChunk || (() => {}),
        signal,
      )
    }

    if (provider.endpointType === 'anthropic') {
      if (options?.webSearchEnabled) {
        throw createUnsupportedWebSearchError()
      }
      return sendAnthropicMessage({
        message,
        history,
        model,
        provider,
        apiKey,
        timeoutMs: this.timeout,
        onChunk: onChunk || (() => {}),
        signal,
        options,
      })
    }

    const url = `${baseUrl}/chat/completions`

    if (options?.webSearchEnabled) {
      if (shouldUseXaiNativeWebSearch(provider, model)) {
        return this.sendXaiNativeWebSearchMessage({
          baseUrl,
          headers,
          body,
          onChunk: onChunk || (() => {}),
          signal,
          options,
        })
      }
      if (isGrokModel(provider, model)) {
        return this.streamResponse(url, headers, body, onChunk || (() => {}), signal, options)
      }
      if (shouldUseWebSearchTextProtocol(provider, model)) {
        return runOpenAIWebSearchTextProtocolRequest({
          body,
          onChunk: onChunk || (() => {}),
          onStatus: options.onWebSearchStatus,
          onApiTranscript: options.onApiTranscript,
          signal,
          request: (nextBody) => this.requestOpenAIChatCompletionWithRetry({
            url,
            headers,
            body: nextBody,
            signal,
            scope: 'web-search-text-protocol-model',
          }),
        })
      }
      return runOpenAIWebSearchToolLoop({
        body,
        onChunk: onChunk || (() => {}),
        onStatus: options.onWebSearchStatus,
        onApiTranscript: options.onApiTranscript,
        signal,
        request: (nextBody) => this.requestOpenAIChatCompletionWithRetry({
          url,
          headers,
          body: nextBody,
          signal,
          scope: 'web-search-model',
        }),
      })
    }

    return this.streamResponse(url, headers, body, onChunk || (() => {}), signal, options)
  }

  private async sendImageGeneration(
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
      body: JSON.stringify(body),
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

  private async sendManagedImageEdit(
    input: { imageUrl: string; model: string; prompt: string },
    onChunk?: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<string> {
    const { body, headers } = buildImageEditMultipartBody(input);
    const payload = await requestManagedImageEdit(body, headers, signal);
    throwIfAborted(signal);
    const content = normalizeGeneratedImageMarkdown(payload);
    emitChunk(onChunk || (() => {}), signal, content);
    return content;
  }

  private async sendImageEdit(
    url: string,
    headers: Record<string, string>,
    input: { imageUrl: string; model: string; prompt: string },
    onChunk: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<string> {
    throwIfAborted(signal)
    const multipart = buildImageEditMultipartBody(input);
    const response = await providerFetch(url, {
      method: 'POST',
      headers: {
        Authorization: headers.Authorization,
        ...multipart.headers,
      },
      body: multipart.body,
      signal,
    });

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

  private async streamResponse(
    url: string,
    headers: Record<string, string>,
    body: ChatCompletionRequest,
    onChunk: (chunk: string) => void,
    signal?: AbortSignal,
    options?: ChatSendOptions
  ): Promise<string> {
    const controller = new AbortController()
    let timedOut = false
    const timeoutId = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, this.timeout)

    const forwardAbort = () => {
      if (!controller.signal.aborted) {
        controller.abort()
      }
    }
    signal?.addEventListener('abort', forwardAbort, { once: true })
    if (signal?.aborted) {
      forwardAbort()
    }

    try {
      if (controller.signal.aborted) {
        throw createAbortError()
      }

      const response = await providerFetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
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
        if (timedOut) {
          throw new Error('The AI request timed out.')
        }
        throw error
      }
      const parsedError = parseAPIError(error)
      const detail = `OpenAI-compatible chat request to ${url} failed: ${summarizeError(error)}`
      if (parsedError.type === AIErrorType.NETWORK_ERROR) {
        throw createAIError(parsedError.type, parsedError.message, detail, parsedError.statusCode)
      }
      throw parsedError
    } finally {
      clearTimeout(timeoutId)
      signal?.removeEventListener('abort', forwardAbort)
    }
  }

  async testConnection(provider: Provider): Promise<boolean> {
    try {
      if (provider.id === MANAGED_PROVIDER_ID) {
        await fetchManagedModels()
        return true
      }

      await this.getModels(provider)
      return true
    } catch {
      return false
    }
  }

  async getModels(provider: Provider, signal?: AbortSignal): Promise<string[]> {
    const result = await this.getModelsWithEndpointDetection(provider, signal)
    return result.models
  }

  async getModelsWithEndpointDetection(provider: Provider, signal?: AbortSignal): Promise<ModelFetchResult> {
    if (provider.id === MANAGED_PROVIDER_ID) {
      throwIfAborted(signal)
      const models = await fetchManagedModels()
      throwIfAborted(signal)
      return {
        models: models.map((model) => model.apiModelId),
        endpointType: 'openai',
      }
    }

    const apiKey = await this.resolveApiKey(provider)
    throwIfAborted(signal)
    return detectProviderEndpointModels(provider, apiKey, signal)
  }
}

export const openaiClient = new OpenAICompatibleClient()
