import { actions as aiActions } from '@/stores/useAIStore';
import { openaiClient } from '@/lib/ai/providers/openai';
import { parseAPIError } from '@/lib/ai/errors';
import { AIErrorType, type AIModel, type ChatMessage, type ChatMessageContent, type ChatSendOptions, type Provider } from '@/lib/ai/types';
import { isManagedProviderId } from '@/lib/ai/managedService';

interface EndpointFallbackClient {
  sendMessage(
    content: ChatMessageContent,
    history: ChatMessage[],
    model: AIModel,
    provider: Provider,
    onChunk?: (chunk: string) => void,
    signal?: AbortSignal,
    options?: ChatSendOptions
  ): Promise<string>;
}

interface SendMessageWithEndpointFallbackOptions {
  content: ChatMessageContent;
  history: ChatMessage[];
  model: AIModel;
  provider: Provider;
  onChunk: (chunk: string) => void;
  signal?: AbortSignal;
  options?: ChatSendOptions;
  client?: EndpointFallbackClient;
  updateProvider?: (providerId: string, updates: Partial<Provider>) => void;
  retryDelayMs?: number;
}

const PRE_STREAM_RETRY_DELAY_MS = 900;

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
    || !!error && typeof error === 'object' && (error as { name?: unknown }).name === 'AbortError';
}

function createAbortError(): DOMException {
  return new DOMException('Aborted', 'AbortError');
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  throw createAbortError();
}

function extractStatusCode(error: unknown): number | null {
  if (!error || typeof error !== 'object') {
    return null;
  }

  const value = (error as { statusCode?: unknown; status?: unknown }).statusCode
    ?? (error as { status?: unknown }).status;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function extractErrorCode(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return '';
  }

  const value = (error as { errorCode?: unknown; code?: unknown }).errorCode
    ?? (error as { code?: unknown }).code;
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function isTransientPreStreamError(error: unknown, signal?: AbortSignal): boolean {
  if (isAbortError(error) && signal?.aborted) {
    return false;
  }

  const statusCode = extractStatusCode(error);
  if (statusCode != null) {
    return statusCode === 408 || statusCode === 500 || statusCode === 502 || statusCode === 503 || statusCode === 504;
  }

  const errorCode = extractErrorCode(error);
  if (
    errorCode === 'upstream_rate_limited' ||
    errorCode === 'points_exhausted' ||
    errorCode === 'inactive_points' ||
    errorCode === 'insufficient_points'
  ) {
    return false;
  }
  if (errorCode === 'upstream_unavailable') {
    return true;
  }

  const parsed = parseAPIError(error);
  return parsed.type === AIErrorType.NETWORK_ERROR
    || parsed.type === AIErrorType.TIMEOUT
    || parsed.type === AIErrorType.SERVER_ERROR;
}

function waitForRetry(delayMs: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(new DOMException('Aborted', 'AbortError'));
  }
  if (delayMs <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout>;
    const abort = () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    const cleanupAndResolve = () => {
      signal?.removeEventListener('abort', abort);
      resolve();
    };

    signal?.addEventListener('abort', abort, { once: true });
    timer = setTimeout(cleanupAndResolve, delayMs);
  });
}

async function sendWithSinglePreStreamRetry(
  send: (onChunk: (chunk: string) => void) => Promise<string>,
  onChunk: (chunk: string) => void,
  signal: AbortSignal | undefined,
  delayMs: number,
  shouldRetry: boolean
): Promise<string> {
  let didReceiveChunk = false;
  const trackedOnChunk = (chunk: string) => {
    throwIfAborted(signal);
    didReceiveChunk = true;
    onChunk(chunk);
    throwIfAborted(signal);
  };

  try {
    const result = await send(trackedOnChunk);
    throwIfAborted(signal);
    return result;
  } catch (error) {
    throwIfAborted(signal);
    if (!shouldRetry || didReceiveChunk || !isTransientPreStreamError(error, signal)) {
      throw error;
    }

    await waitForRetry(delayMs, signal);
    throwIfAborted(signal);
    didReceiveChunk = false;
    const result = await send(trackedOnChunk);
    throwIfAborted(signal);
    return result;
  }
}

export async function sendMessageWithEndpointFallback({
  content,
  history,
  model,
  provider,
  onChunk,
  signal,
  options,
  client = openaiClient,
  updateProvider = aiActions.updateProvider,
  retryDelayMs = PRE_STREAM_RETRY_DELAY_MS,
}: SendMessageWithEndpointFallbackOptions): Promise<string> {
  throwIfAborted(signal);
  const shouldAutoRetry = options?.webSearchEnabled !== true;

  if (isManagedProviderId(provider.id) || (provider.endpointType && provider.endpointTypeCheckedAt)) {
    return sendWithSinglePreStreamRetry(
      (trackedOnChunk) => client.sendMessage(content, history, model, provider, trackedOnChunk, signal, options),
      onChunk,
      signal,
      retryDelayMs,
      shouldAutoRetry,
    );
  }

  let didReceiveOpenAIChunk = false;

  try {
    const result = await sendWithSinglePreStreamRetry(
      (trackedOnChunk) => client.sendMessage(
        content,
        history,
        model,
        { ...provider, endpointType: 'openai' },
        (chunk) => {
          didReceiveOpenAIChunk = true;
          trackedOnChunk(chunk);
        },
        signal,
        options,
      ),
      onChunk,
      signal,
      retryDelayMs,
      shouldAutoRetry,
    );
    throwIfAborted(signal);
    updateProvider(provider.id, { endpointType: 'openai', endpointTypeCheckedAt: Date.now() });
    return result;
  } catch (openAIError) {
    if (signal?.aborted) {
      throw openAIError;
    }
    if (didReceiveOpenAIChunk) {
      throw openAIError;
    }
    if (options?.webSearchEnabled) {
      throw openAIError;
    }

    try {
      const result = await sendWithSinglePreStreamRetry(
        (trackedOnChunk) => client.sendMessage(
          content,
          history,
          model,
          { ...provider, endpointType: 'anthropic' },
          trackedOnChunk,
          signal,
          options,
        ),
        onChunk,
        signal,
        retryDelayMs,
        shouldAutoRetry,
      );
      throwIfAborted(signal);
      updateProvider(provider.id, { endpointType: 'anthropic', endpointTypeCheckedAt: Date.now() });
      return result;
    } catch (anthropicError) {
      throw anthropicError;
    }
  }
}
