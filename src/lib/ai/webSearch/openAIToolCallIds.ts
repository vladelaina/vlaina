import type { OpenAIToolCall } from './openAIToolTypes';

const UNSAFE_TOOL_CALL_ID_CHARS = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\uFFFD]/u;

export function isSafeOpenAIToolCallId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 512
    && !UNSAFE_TOOL_CALL_ID_CHARS.test(value);
}

export function filterUniqueOpenAIToolCalls(toolCalls: OpenAIToolCall[]): OpenAIToolCall[] {
  const seenIds = new Set<string>();
  return toolCalls.filter((call) => {
    if (!isSafeOpenAIToolCallId(call.id) || seenIds.has(call.id)) return false;
    seenIds.add(call.id);
    return true;
  });
}
