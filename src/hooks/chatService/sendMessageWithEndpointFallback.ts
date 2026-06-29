import { actions as aiActions } from '@/stores/useAIStore';
import { openaiClient } from '@/lib/ai/providers/openai';
import type { AIModel, ChatMessage, ChatMessageContent, ChatSendOptions, Provider } from '@/lib/ai/types';
import { isManagedProviderId } from '@/lib/ai/managedService';
import {
  type EndpointType,
  getAlternateEndpointType,
  getVerifiedModelEndpointType,
  getVerifiedProviderEndpointType,
  isLikelyAnthropicModel,
  isTransientEndpointPreStreamError,
  shouldTryAlternateEndpointAfterEndpointError,
  shouldTryAnthropicEndpointDuringDiscovery,
} from '@/lib/ai/endpointFallback';

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
  updateModel?: (modelId: string, updates: Partial<AIModel>) => void;
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

function isTransientPreStreamError(error: unknown, signal?: AbortSignal): boolean {
  if (isAbortError(error) && signal?.aborted) {
    return false;
  }

  return isTransientEndpointPreStreamError(error);
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
  updateModel = aiActions.updateModel,
  retryDelayMs = PRE_STREAM_RETRY_DELAY_MS,
}: SendMessageWithEndpointFallbackOptions): Promise<string> {
  throwIfAborted(signal);
  if (import.meta.env.DEV) {
    const { maybeSendChatE2EMockMessage } = await import('@/lib/e2e/chatE2EMock');
    const e2eMockResult = await maybeSendChatE2EMockMessage({
      content,
      history,
      model,
      provider,
      onChunk,
      signal,
      options,
    });
    if (e2eMockResult.handled) {
      return e2eMockResult.content;
    }
  }

  const shouldAutoRetry = options?.webSearchEnabled !== true;
  const verifiedModelEndpointType = getVerifiedModelEndpointType(model);
  const verifiedProviderEndpointType = getVerifiedProviderEndpointType(provider);
  const isManagedProvider = isManagedProviderId(provider.id);

  if (isManagedProvider) {
    return sendWithSinglePreStreamRetry(
      (trackedOnChunk) => client.sendMessage(content, history, model, provider, trackedOnChunk, signal, options),
      onChunk,
      signal,
      retryDelayMs,
      shouldAutoRetry,
    );
  }

  const sendWithEndpointType = (
    endpointType: EndpointType,
    onAttemptChunk?: () => void,
  ) => sendWithSinglePreStreamRetry(
    (trackedOnChunk) => client.sendMessage(
      content,
      history,
      model,
      { ...provider, endpointType },
      (chunk) => {
        onAttemptChunk?.();
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

  const sendWithVerifiedEndpoint = async (endpointType: EndpointType): Promise<string> => {
    if (!isLikelyAnthropicModel(model)) {
      return await sendWithEndpointType(endpointType);
    }

    let didReceiveEndpointChunk = false;
    try {
      const result = await sendWithEndpointType(endpointType, () => {
        didReceiveEndpointChunk = true;
      });
      throwIfAborted(signal);
      return result;
    } catch (error) {
      if (
        signal?.aborted ||
        didReceiveEndpointChunk ||
        options?.webSearchEnabled ||
        !shouldTryAlternateEndpointAfterEndpointError(error)
      ) {
        throw error;
      }

      const alternateEndpointType = getAlternateEndpointType(endpointType);
      const result = await sendWithEndpointType(alternateEndpointType);
      throwIfAborted(signal);
      updateModel(model.id, { endpointType: alternateEndpointType, endpointTypeCheckedAt: Date.now() });
      return result;
    }
  };

  if (verifiedModelEndpointType) {
    return await sendWithVerifiedEndpoint(verifiedModelEndpointType);
  }

  if (verifiedProviderEndpointType) {
    return await sendWithVerifiedEndpoint(verifiedProviderEndpointType);
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
    if (!isLikelyAnthropicModel(model)) {
      throw openAIError;
    }
    if (!shouldTryAnthropicEndpointDuringDiscovery(openAIError)) {
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
      if (isLikelyAnthropicModel(model)) {
        updateModel(model.id, { endpointType: 'anthropic', endpointTypeCheckedAt: Date.now() });
      } else {
        updateProvider(provider.id, { endpointType: 'anthropic', endpointTypeCheckedAt: Date.now() });
      }
      return result;
    } catch (anthropicError) {
      throw anthropicError;
    }
  }
}
