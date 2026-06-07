import { WEB_SEARCH_SYSTEM_INSTRUCTION } from './toolDefinitions';
import type { OpenAIToolCall, OpenAIWireMessage } from './openAIToolTypes';

export const MAX_OPENAI_TOOL_CALLS = 16;
export const MAX_OPENAI_TOOL_ARGUMENT_CHARS = 64 * 1024;
export const MAX_DSML_TOOL_MARKUP_CHARS = 256 * 1024;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function boundedToolString(value: unknown, maxChars: number): string {
  return typeof value === 'string' ? value.slice(0, maxChars) : '';
}

export function canParseOpenAIToolArguments(value: string): boolean {
  return value.length <= MAX_OPENAI_TOOL_ARGUMENT_CHARS;
}

export function limitOpenAIToolArguments(value: string): string {
  return value.length > MAX_OPENAI_TOOL_ARGUMENT_CHARS
    ? value.slice(0, MAX_OPENAI_TOOL_ARGUMENT_CHARS)
    : value;
}

export function normalizeOpenAIToolArgumentsValue(value: unknown): string {
  if (typeof value === 'string') {
    return limitOpenAIToolArguments(value);
  }

  try {
    return limitOpenAIToolArguments(JSON.stringify(value ?? {}));
  } catch {
    return '{}';
  }
}

function appendOpenAIToolArguments(existing: string, next: unknown): string {
  if (typeof next !== 'string' || existing.length >= MAX_OPENAI_TOOL_ARGUMENT_CHARS) {
    return existing;
  }

  const remaining = MAX_OPENAI_TOOL_ARGUMENT_CHARS - existing.length;
  return existing + next.slice(0, remaining);
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

function parseToolCallIndex(value: unknown): number | null {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim()
      ? Number(value)
      : null;
  return typeof parsed === 'number'
    && Number.isInteger(parsed)
    && parsed >= 0
    && parsed < MAX_OPENAI_TOOL_CALLS
    ? parsed
    : null;
}

function nextToolCallIndex(toolCalls: OpenAIToolCall[]): number {
  return toolCalls.length < MAX_OPENAI_TOOL_CALLS ? toolCalls.length : -1;
}

function resolveToolCallIndex(
  deltaCall: Record<string, unknown>,
  deltaFunction: Record<string, unknown>,
  toolCalls: OpenAIToolCall[],
): number {
  const explicitIndex = parseToolCallIndex(deltaCall.index);
  if (explicitIndex != null) {
    return explicitIndex;
  }

  const id = typeof deltaCall.id === 'string' && deltaCall.id.trim() ? deltaCall.id : '';
  if (id) {
    const existingIndex = toolCalls.findIndex((call) => call?.id === id);
    if (existingIndex >= 0) {
      return existingIndex;
    }

    const name = typeof deltaFunction.name === 'string' ? deltaFunction.name : '';
    const unidentifiedIndex = toolCalls.findIndex((call) =>
      call && !call.id && (!name || !call.function.name || call.function.name === name)
    );
    if (unidentifiedIndex >= 0) {
      return unidentifiedIndex;
    }

    return nextToolCallIndex(toolCalls);
  }

  const hasArguments = typeof deltaFunction.arguments === 'string';
  const hasName = typeof deltaFunction.name === 'string' && deltaFunction.name.trim().length > 0;
  if (hasArguments && !hasName && toolCalls.length > 0) {
    for (let index = toolCalls.length - 1; index >= 0; index -= 1) {
      if (toolCalls[index]) {
        return index;
      }
    }
  }

  return nextToolCallIndex(toolCalls);
}

export function extractOpenAIToolCalls(payload: Record<string, unknown>, toolCalls: OpenAIToolCall[]): void {
  const choice = Array.isArray(payload.choices) ? payload.choices[0] : null;
  if (!isRecord(choice) || !isRecord(choice.delta) || !Array.isArray(choice.delta.tool_calls)) {
    return;
  }

  for (const deltaCall of choice.delta.tool_calls.slice(0, MAX_OPENAI_TOOL_CALLS)) {
    if (!isRecord(deltaCall)) continue;
    const deltaFunction = isRecord(deltaCall.function) ? deltaCall.function : {};
    const index = resolveToolCallIndex(deltaCall, deltaFunction, toolCalls);
    if (index < 0 || index >= MAX_OPENAI_TOOL_CALLS) continue;
    const existing = toolCalls[index] ?? {
      id: '',
      type: 'function' as const,
      function: { name: '', arguments: '' },
    };
    toolCalls[index] = {
      id: boundedToolString(deltaCall.id, 512) || existing.id,
      type: 'function',
      function: {
        name: boundedToolString(deltaFunction.name, 128) || existing.function.name,
        arguments: appendOpenAIToolArguments(existing.function.arguments, deltaFunction.arguments),
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

function extractResponsesApiContentDelta(payload: Record<string, unknown>): { reasoning?: string; content?: string } | null {
  const type = typeof payload.type === 'string' ? payload.type.toLowerCase() : '';
  if (!type.endsWith('.delta')) {
    return null;
  }

  const delta = extractOpenAIText(payload.delta);
  if (!delta) {
    return null;
  }

  if (type.includes('reasoning') || type.includes('thinking')) {
    return { reasoning: delta };
  }
  if (type.includes('output_text') || type.includes('content')) {
    return { content: delta };
  }
  return null;
}

function dsmlPattern(name: string): string {
  return `<[|｜]{2}\\s*DSML\\s*[|｜]{2}\\s*${name}`;
}

const DSML_TOOL_CALLS_BLOCK_RE = new RegExp(
  `${dsmlPattern('tool_calls')}[^>]*>[\\s\\S]*?<\\/[|｜]{2}\\s*DSML\\s*[|｜]{2}\\s*tool_calls\\s*>`,
  'gi',
);

const DSML_INVOKE_RE = new RegExp(
  `${dsmlPattern('invoke')}\\s+name=["']([^"']+)["'][^>]*>([\\s\\S]*?)<\\/[|｜]{2}\\s*DSML\\s*[|｜]{2}\\s*invoke\\s*>`,
  'gi',
);

const DSML_PARAMETER_RE = new RegExp(
  `${dsmlPattern('parameter')}\\s+name=["']([^"']+)["'][^>]*>([\\s\\S]*?)<\\/[|｜]{2}\\s*DSML\\s*[|｜]{2}\\s*parameter\\s*>`,
  'gi',
);

export function stripDsmlToolCallMarkup(content: string): string {
  if (content.length > MAX_DSML_TOOL_MARKUP_CHARS) {
    return content;
  }
  return content.replace(DSML_TOOL_CALLS_BLOCK_RE, '').trim();
}

function extractDsmlToolCalls(content: string): OpenAIToolCall[] {
  if (content.length > MAX_DSML_TOOL_MARKUP_CHARS) {
    return [];
  }

  const calls: OpenAIToolCall[] = [];
  for (const block of content.matchAll(DSML_TOOL_CALLS_BLOCK_RE)) {
    if (calls.length >= MAX_OPENAI_TOOL_CALLS) break;
    const blockText = block[0];
    for (const invoke of blockText.matchAll(DSML_INVOKE_RE)) {
      if (calls.length >= MAX_OPENAI_TOOL_CALLS) break;
      const name = boundedToolString(invoke[1]?.trim(), 128);
      const body = invoke[2] ?? '';
      if (!name) continue;
      const args: Record<string, string> = {};
      for (const parameter of body.matchAll(DSML_PARAMETER_RE)) {
        const key = boundedToolString(parameter[1]?.trim(), 128);
        if (!key) continue;
        args[key] = limitOpenAIToolArguments((parameter[2] ?? '').trim());
      }
      calls.push({
        id: `dsml_${calls.length}`,
        type: 'function',
        function: {
          name,
          arguments: normalizeOpenAIToolArgumentsValue(args),
        },
      });
    }
  }
  return calls;
}

export function extractOpenAIContentDelta(payload: Record<string, unknown>): { reasoning?: string; content?: string } {
  const choice = Array.isArray(payload.choices) ? payload.choices[0] : null;
  if (!isRecord(choice)) {
    return extractResponsesApiContentDelta(payload) ?? {};
  }
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
  reasoningContent: string;
  toolCalls: OpenAIToolCall[];
} {
  const choice = Array.isArray(payload.choices) ? payload.choices[0] : null;
  const message = isRecord(choice) && isRecord(choice.message) ? choice.message : {};
  const rawToolCalls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
  const rawContent = extractOpenAIText(message.content);
  const dsmlToolCalls = extractDsmlToolCalls(rawContent);

  const toolCalls: OpenAIToolCall[] = [];
  const rawToolCallCount = Math.min(rawToolCalls.length, MAX_OPENAI_TOOL_CALLS);
  for (let index = 0; index < rawToolCallCount; index += 1) {
    const rawCall = rawToolCalls[index];
    if (!isRecord(rawCall) || !isRecord(rawCall.function)) continue;
    const id = boundedToolString(rawCall.id, 512);
    const name = boundedToolString(rawCall.function.name, 128);
    const args = normalizeOpenAIToolArgumentsValue(rawCall.function.arguments);
    if (!id || !name) continue;
    toolCalls.push({ id, type: 'function', function: { name, arguments: args } });
  }

  return {
    content: stripDsmlToolCallMarkup(rawContent),
    reasoningContent: extractOpenAIText(message.reasoning_content ?? message.reasoning),
    toolCalls: toolCalls.concat(dsmlToolCalls).slice(0, MAX_OPENAI_TOOL_CALLS),
  };
}
