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
  let buffer = '';

  const consumeLine = (line: string) => {
    const payload = parseOpenAIPayloadText(line);
    if (!payload) return;
    extractOpenAIToolCalls(payload, toolCalls);
    accumulator.pushDelta(extractOpenAIContentDelta(payload));
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
    toolCalls: toolCalls.filter((call) => call.id && call.function.name),
  };
}
