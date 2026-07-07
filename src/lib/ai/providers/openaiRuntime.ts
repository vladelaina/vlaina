import type { ApiTranscriptMessage, ChatSendOptions } from '../types'
import { createAIError, parseAPIError } from '../errors'
import { AIErrorType } from '../types'
import { readBoundedProviderJsonResponse, readBoundedProviderResponseText } from './boundedResponseText'

const MAX_PROVIDER_ERROR_SUMMARY_CHARS = 8192

export function summarizeError(error: unknown): string {
  let message = ''
  if (error instanceof Error) {
    message = error.message
  } else if (error && typeof error === 'object' && typeof (error as { message?: unknown }).message === 'string') {
    message = (error as { message: string }).message
  } else {
    switch (typeof error) {
      case 'string':
      case 'number':
      case 'boolean':
      case 'bigint':
      case 'symbol':
        message = String(error)
        break
      default:
        message = ''
    }
  }
  return (message || 'Unknown error').slice(0, MAX_PROVIDER_ERROR_SUMMARY_CHARS)
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

export function rejectHtmlErrorContent(content: string): string {
  if (isLikelyHtmlErrorContent(content)) {
    throw createAIError(AIErrorType.SERVER_ERROR, 'UPSTREAM_UNAVAILABLE')
  }
  return content
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
    || !!error && typeof error === 'object' && (error as { name?: unknown }).name === 'AbortError'
}

export function createAbortError(): DOMException {
  return new DOMException('Aborted', 'AbortError')
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return
  throw createAbortError()
}

export function emitChunk(onChunk: (chunk: string) => void, signal: AbortSignal | undefined, chunk: string): void {
  throwIfAborted(signal)
  onChunk(chunk)
  throwIfAborted(signal)
}

export function emitApiTranscript(
  onApiTranscript: ChatSendOptions['onApiTranscript'] | undefined,
  signal: AbortSignal | undefined,
  messages: ApiTranscriptMessage[]
): void {
  throwIfAborted(signal)
  onApiTranscript?.(messages)
  throwIfAborted(signal)
}

export function emitWebSearchStatus(
  onWebSearchStatus: ChatSendOptions['onWebSearchStatus'] | undefined,
  signal: AbortSignal | undefined,
  status: Parameters<NonNullable<ChatSendOptions['onWebSearchStatus']>>[0]
): void {
  throwIfAborted(signal)
  onWebSearchStatus?.(status)
  throwIfAborted(signal)
}

export function createHtmlRejectingChunkHandler(onChunk: (chunk: string) => void, signal?: AbortSignal): (chunk: string) => void {
  return (chunk) => {
    rejectHtmlErrorContent(chunk)
    emitChunk(onChunk, signal, chunk)
  }
}

export async function readResponseTextOrFallback(response: Response, signal?: AbortSignal): Promise<string> {
  return await readBoundedProviderResponseText(response, signal)
}

export async function readResponseJson<T>(response: Response, signal?: AbortSignal): Promise<T> {
  return await readBoundedProviderJsonResponse<T>(response, signal)
}

export function isTransientHttpStatus(status: number): boolean {
  return status === 408 || status === 500 || status === 502 || status === 503 || status === 504
}

export function waitForProviderRetry(delayMs: number, signal?: AbortSignal): Promise<void> {
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

export function hasHttpStatus(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  return typeof (error as { statusCode?: unknown }).statusCode === 'number'
    || typeof (error as { status?: unknown }).status === 'number'
}

export function throwParsedOpenAIError(error: unknown, url: string): never {
  const parsedError = parseAPIError(error)
  const detail = `OpenAI-compatible chat request to ${url} failed: ${summarizeError(error)}`
  if (parsedError.type === AIErrorType.NETWORK_ERROR) {
    throw createAIError(parsedError.type, parsedError.message, detail, parsedError.statusCode)
  }
  throw parsedError
}
