import { createStreamAccumulator } from '@/lib/ai/streaming';
import {
  extractOpenAIContentDelta,
  extractOpenAIToolCalls,
  parseOpenAIPayloadText,
} from './openAIToolParsing';
import type { OpenAIStreamToolResult, OpenAIToolCall } from './openAIToolTypes';

export async function consumeOpenAIStreamWithTools(
  response: Response,
  onChunk: (chunk: string) => void,
): Promise<OpenAIStreamToolResult> {
  if (!response.body) {
    throw new Error('Response body is null');
  }

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

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    lines.forEach(consumeLine);
  }

  if (buffer.trim()) {
    consumeLine(buffer);
  }

  return {
    content: accumulator.finish(),
    assistantContent,
    reasoningContent,
    toolCalls: toolCalls.filter((call) => call.id && call.function.name),
  };
}
