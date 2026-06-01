import { createStreamAccumulator } from '@/lib/ai/streaming';
import {
  extractOpenAIContentDelta,
  extractOpenAIToolCalls,
  parseOpenAIPayloadText,
} from './openAIToolParsing';
import type { OpenAIStreamToolResult, OpenAIToolCall } from './openAIToolTypes';

interface ConsumeOpenAIStreamWithToolsOptions {
  signal?: AbortSignal;
}

function createAbortError(): DOMException {
  return new DOMException('The web search request was cancelled.', 'AbortError');
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  throw createAbortError();
}

export async function consumeOpenAIStreamWithTools(
  response: Response,
  onChunk: (chunk: string) => void,
  options: ConsumeOpenAIStreamWithToolsOptions = {},
): Promise<OpenAIStreamToolResult> {
  if (!response.body) {
    throw new Error('Response body is null');
  }

  const { signal } = options;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const accumulator = createStreamAccumulator(onChunk);
  const toolCalls: OpenAIToolCall[] = [];
  let assistantContent = '';
  let reasoningContent = '';
  let buffer = '';

  const consumeLine = (line: string) => {
    const payload = parseOpenAIPayloadText(line);
    if (!payload) return;
    const nestedError = payload.error;
    if (
      nestedError &&
      typeof nestedError === 'object' &&
      'message' in nestedError &&
      typeof nestedError.message === 'string'
    ) {
      throw new Error(nestedError.message);
    }
    extractOpenAIToolCalls(payload, toolCalls);
    const delta = extractOpenAIContentDelta(payload);
    if (delta.content) assistantContent += delta.content;
    if (delta.reasoning) reasoningContent += delta.reasoning;
    accumulator.pushDelta(delta);
  };

  const cancelReader = () => {
    void reader.cancel(createAbortError()).catch(() => undefined);
  };

  if (signal?.aborted) {
    await reader.cancel(createAbortError()).catch(() => undefined);
    reader.releaseLock();
    throw createAbortError();
  }

  signal?.addEventListener('abort', cancelReader, { once: true });

  try {
    while (true) {
      throwIfAborted(signal);
      const { done, value } = await reader.read();
      throwIfAborted(signal);
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        throwIfAborted(signal);
        consumeLine(line);
        throwIfAborted(signal);
      }
    }

    if (buffer.trim()) {
      throwIfAborted(signal);
      consumeLine(buffer);
      throwIfAborted(signal);
    }

    const result = {
      content: accumulator.finish(),
      assistantContent,
      reasoningContent,
      toolCalls: toolCalls.filter((call) => call.id && call.function.name),
    };
    throwIfAborted(signal);
    return result;
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    if (signal?.aborted && !(
      error instanceof Error && error.name === 'AbortError'
    )) {
      throw createAbortError();
    }
    throw error;
  } finally {
    signal?.removeEventListener('abort', cancelReader);
    reader.releaseLock();
  }
}
