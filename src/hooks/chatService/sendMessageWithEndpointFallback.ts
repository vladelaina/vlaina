import { actions as aiActions } from '@/stores/useAIStore';
import { openaiClient } from '@/lib/ai/providers/openai';
import type { AIModel, ChatMessage, ChatMessageContent, Provider } from '@/lib/ai/types';
import { isManagedProviderId } from '@/lib/ai/managedService';

interface EndpointFallbackClient {
  sendMessage(
    content: ChatMessageContent,
    history: ChatMessage[],
    model: AIModel,
    provider: Provider,
    onChunk?: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<string>;
}

interface SendMessageWithEndpointFallbackOptions {
  content: ChatMessageContent;
  history: ChatMessage[];
  model: AIModel;
  provider: Provider;
  onChunk: (chunk: string) => void;
  signal?: AbortSignal;
  client?: EndpointFallbackClient;
  updateProvider?: (providerId: string, updates: Partial<Provider>) => void;
}

export async function sendMessageWithEndpointFallback({
  content,
  history,
  model,
  provider,
  onChunk,
  signal,
  client = openaiClient,
  updateProvider = aiActions.updateProvider,
}: SendMessageWithEndpointFallbackOptions): Promise<string> {
  if (isManagedProviderId(provider.id) || (provider.endpointType && provider.endpointTypeCheckedAt)) {
    return client.sendMessage(content, history, model, provider, onChunk, signal);
  }

  let didReceiveOpenAIChunk = false;
  const handleOpenAIChunk = (chunk: string) => {
    didReceiveOpenAIChunk = true;
    onChunk(chunk);
  };

  try {
    const result = await client.sendMessage(
      content,
      history,
      model,
      { ...provider, endpointType: 'openai' },
      handleOpenAIChunk,
      signal,
    );
    updateProvider(provider.id, { endpointType: 'openai', endpointTypeCheckedAt: Date.now() });
    return result;
  } catch (openAIError) {
    if (signal?.aborted || (openAIError instanceof Error && openAIError.name === 'AbortError')) {
      throw openAIError;
    }
    if (didReceiveOpenAIChunk) {
      throw openAIError;
    }

    try {
      const result = await client.sendMessage(
        content,
        history,
        model,
        { ...provider, endpointType: 'anthropic' },
        onChunk,
        signal,
      );
      updateProvider(provider.id, { endpointType: 'anthropic', endpointTypeCheckedAt: Date.now() });
      return result;
    } catch (anthropicError) {
      throw anthropicError;
    }
  }
}
