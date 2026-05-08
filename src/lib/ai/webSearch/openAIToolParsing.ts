import { WEB_SEARCH_SYSTEM_INSTRUCTION } from './toolDefinitions';
import type { OpenAIToolCall, OpenAIWireMessage } from './openAIToolTypes';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function parseOpenAIPayloadText(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  if (!trimmed || trimmed === '[DONE]') return null;
  const payloadText = trimmed.startsWith('data:') ? trimmed.slice(5).trim() : trimmed;
  if (!payloadText || payloadText === '[DONE]') return null;

  try {
    return JSON.parse(payloadText) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function extractOpenAIToolCalls(payload: Record<string, unknown>, toolCalls: OpenAIToolCall[]): void {
  const choice = Array.isArray(payload.choices) ? payload.choices[0] : null;
  if (!isRecord(choice) || !isRecord(choice.delta) || !Array.isArray(choice.delta.tool_calls)) {
    return;
  }

  for (const deltaCall of choice.delta.tool_calls) {
    if (!isRecord(deltaCall)) continue;
    const index = Number(deltaCall.index ?? toolCalls.length);
    const existing = toolCalls[index] ?? {
      id: '',
      type: 'function' as const,
      function: { name: '', arguments: '' },
    };
    const deltaFunction = isRecord(deltaCall.function) ? deltaCall.function : {};
    toolCalls[index] = {
      id: typeof deltaCall.id === 'string' ? deltaCall.id : existing.id,
      type: 'function',
      function: {
        name: typeof deltaFunction.name === 'string' ? deltaFunction.name : existing.function.name,
        arguments:
          existing.function.arguments +
          (typeof deltaFunction.arguments === 'string' ? deltaFunction.arguments : ''),
      },
    };
  }
}

export function extractOpenAIText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(extractOpenAIText).join('');
  if (!isRecord(value)) return '';
  if (typeof value.text === 'string') return value.text;
  if (typeof value.content === 'string') return value.content;
  return '';
}

export function extractOpenAIContentDelta(payload: Record<string, unknown>): { reasoning?: string; content?: string } {
  const choice = Array.isArray(payload.choices) ? payload.choices[0] : null;
  if (!isRecord(choice)) return {};
  const source = isRecord(choice.delta) ? choice.delta : isRecord(choice.message) ? choice.message : null;
  if (!source) return {};
  return {
    reasoning: extractOpenAIText(source.reasoning_content ?? source.reasoning) || undefined,
    content: extractOpenAIText(source.content) || undefined,
  };
}

export function appendWebSearchSystemInstruction(messages: OpenAIWireMessage[]): OpenAIWireMessage[] {
  const [first, ...rest] = messages;
  if (first?.role === 'system' && typeof first.content === 'string') {
    return [{ ...first, content: `${first.content}\n\n${WEB_SEARCH_SYSTEM_INSTRUCTION}` }, ...rest];
  }
  return [{ role: 'system', content: WEB_SEARCH_SYSTEM_INSTRUCTION }, ...messages];
}

export function extractOpenAIMessageFromJson(payload: Record<string, unknown>): {
  content: string;
  toolCalls: OpenAIToolCall[];
} {
  const choice = Array.isArray(payload.choices) ? payload.choices[0] : null;
  const message = isRecord(choice) && isRecord(choice.message) ? choice.message : {};
  const rawToolCalls = Array.isArray(message.tool_calls) ? message.tool_calls : [];

  return {
    content: extractOpenAIText(message.content),
    toolCalls: rawToolCalls
      .map((rawCall): OpenAIToolCall | null => {
        if (!isRecord(rawCall) || !isRecord(rawCall.function)) return null;
        const id = typeof rawCall.id === 'string' ? rawCall.id : '';
        const name = typeof rawCall.function.name === 'string' ? rawCall.function.name : '';
        const rawArguments = rawCall.function.arguments;
        const args = typeof rawArguments === 'string' ? rawArguments : JSON.stringify(rawArguments ?? {});
        if (!id || !name) return null;
        return { id, type: 'function', function: { name, arguments: args } };
      })
      .filter((call): call is OpenAIToolCall => call !== null),
  };
}
