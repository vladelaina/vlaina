import { actions as aiActions } from '@/stores/useAIStore';
import { openaiClient } from '@/lib/ai/providers/openai';
import { AIErrorType, type AIModel, type ChatMessage, type ChatMessageContent, type ChatSendOptions, type Provider } from '@/lib/ai/types';
import { isManagedProviderId } from '@/lib/ai/managedService';
import {
  type EndpointType,
  getAlternateEndpointType,
  getVerifiedModelEndpointType,
  getVerifiedProviderEndpointType,
  isLikelyAnthropicModel,
  shouldTryAlternateEndpointAfterEndpointError,
  shouldTryAnthropicEndpointDuringDiscovery,
} from '@/lib/ai/endpointFallback';
import {
  isDevRetrySimulationEnabled,
  PRE_STREAM_RETRY_DELAY_MS,
  sendWithPreStreamRetry,
  throwIfAborted,
} from './preStreamRetry';

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

const DEV_RETRY_SIMULATION_ERROR = {
  type: AIErrorType.SERVER_ERROR,
  message: 'Service unavailable',
  statusCode: 503,
};

const devRetrySimulationClient: EndpointFallbackClient = {
  sendMessage: async () => {
    throw DEV_RETRY_SIMULATION_ERROR;
  },
};

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
  if (import.meta.env.DEV && !isDevRetrySimulationEnabled()) {
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

  const sendWithActiveClient: EndpointFallbackClient['sendMessage'] = (...args) => {
    const activeClient = import.meta.env.DEV && isDevRetrySimulationEnabled()
      ? devRetrySimulationClient
      : client;
    return activeClient.sendMessage(...args);
  };
  const shouldAutoRetry = options?.webSearchEnabled !== true;
  const onRetryStatus = options?.onRetryStatus;
  const verifiedModelEndpointType = getVerifiedModelEndpointType(model);
  const verifiedProviderEndpointType = getVerifiedProviderEndpointType(provider);
  const isManagedProvider = isManagedProviderId(provider.id);

  if (isManagedProvider) {
    return sendWithPreStreamRetry(
      (trackedOnChunk) => sendWithActiveClient(content, history, model, provider, trackedOnChunk, signal, options),
      onChunk,
      signal,
      retryDelayMs,
      shouldAutoRetry,
      onRetryStatus,
    );
  }

  const sendWithEndpointType = (
    endpointType: EndpointType,
    onAttemptChunk?: () => void,
  ) => sendWithPreStreamRetry(
    (trackedOnChunk) => sendWithActiveClient(
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
    onRetryStatus,
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
    const result = await sendWithPreStreamRetry(
      (trackedOnChunk) => sendWithActiveClient(
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
      onRetryStatus,
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
      const result = await sendWithPreStreamRetry(
        (trackedOnChunk) => sendWithActiveClient(
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
        onRetryStatus,
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
