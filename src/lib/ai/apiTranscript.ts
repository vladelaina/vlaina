import type { ApiTranscriptMessage, ChatMessageContent, ChatMessageContentPart } from './types';

const MAX_API_TRANSCRIPT_MESSAGES = 64;
const MAX_API_TRANSCRIPT_STRING_CHARS = 20000;
const MAX_API_TRANSCRIPT_CONTENT_PARTS = 64;
const MAX_API_TRANSCRIPT_TOOL_CALLS = 32;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function clipString(value: string): string {
  return value.length > MAX_API_TRANSCRIPT_STRING_CHARS
    ? value.slice(0, MAX_API_TRANSCRIPT_STRING_CHARS)
    : value;
}

function normalizeContentPart(value: unknown): ChatMessageContentPart | null {
  if (!isRecord(value)) return null;

  if (value.type === 'text' && typeof value.text === 'string') {
    return { type: 'text', text: clipString(value.text) };
  }

  if (value.type === 'image_url' && isRecord(value.image_url) && typeof value.image_url.url === 'string') {
    const detail = value.image_url.detail;
    return {
      type: 'image_url',
      image_url: {
        url: clipString(value.image_url.url),
        ...(detail === 'auto' || detail === 'low' || detail === 'high' ? { detail } : {}),
      },
    };
  }

  return null;
}

function normalizeContent(value: unknown): ChatMessageContent | null | undefined {
  if (typeof value === 'string') {
    return clipString(value);
  }

  if (value === null) {
    return null;
  }

  if (!Array.isArray(value)) {
    return undefined;
  }

  const parts = value
    .slice(0, MAX_API_TRANSCRIPT_CONTENT_PARTS)
    .map(normalizeContentPart)
    .filter((part): part is ChatMessageContentPart => part !== null);
  return parts.length > 0 ? parts : undefined;
}

function normalizeApiTranscriptToolCall(toolCall: unknown): NonNullable<ApiTranscriptMessage['tool_calls']>[number] | null {
  if (!isRecord(toolCall) || !isRecord(toolCall.function)) return null;
  if (
    typeof toolCall.id !== 'string' ||
    toolCall.type !== 'function' ||
    typeof toolCall.function.name !== 'string' ||
    typeof toolCall.function.arguments !== 'string'
  ) {
    return null;
  }

  return {
    id: clipString(toolCall.id),
    type: 'function',
    function: {
      name: clipString(toolCall.function.name),
      arguments: clipString(toolCall.function.arguments),
    },
  };
}

export function normalizeApiTranscriptMessage(value: unknown): ApiTranscriptMessage | null {
  if (!isRecord(value) || !['system', 'user', 'assistant', 'tool'].includes(String(value.role))) {
    return null;
  }

  const normalized: ApiTranscriptMessage = { role: String(value.role) };
  if ('content' in value) {
    normalized.content = normalizeContent(value.content) ?? null;
  }
  if (typeof value.reasoning_content === 'string' && value.reasoning_content.length > 0) {
    normalized.reasoning_content = clipString(value.reasoning_content);
  }

  const toolCalls = Array.isArray(value.tool_calls)
    ? value.tool_calls
        .slice(0, MAX_API_TRANSCRIPT_TOOL_CALLS)
        .map(normalizeApiTranscriptToolCall)
        .filter((toolCall): toolCall is NonNullable<ApiTranscriptMessage['tool_calls']>[number] => toolCall !== null)
    : [];
  if (toolCalls.length > 0) {
    normalized.tool_calls = toolCalls;
  }

  if (typeof value.tool_call_id === 'string' && value.tool_call_id.length > 0) {
    normalized.tool_call_id = clipString(value.tool_call_id);
  }
  if (typeof value.name === 'string' && value.name.length > 0) {
    normalized.name = clipString(value.name);
  }

  if ((normalized.role === 'system' || normalized.role === 'user') && normalized.content === undefined) {
    normalized.content = '';
  }
  if (normalized.role === 'tool' && !normalized.tool_call_id) {
    return null;
  }
  if (normalized.role === 'tool' && normalized.content === undefined) {
    normalized.content = '';
  }
  if (
    normalized.role === 'assistant' &&
    normalized.content == null &&
    (normalized.reasoning_content || normalized.tool_calls?.length)
  ) {
    normalized.content = '';
  }
  if (
    normalized.role === 'assistant' &&
    normalized.content == null &&
    !normalized.reasoning_content &&
    !normalized.tool_calls?.length
  ) {
    return null;
  }

  return normalized;
}

export function normalizeApiTranscriptMessages(value: unknown): ApiTranscriptMessage[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized = value
    .slice(-MAX_API_TRANSCRIPT_MESSAGES)
    .map(normalizeApiTranscriptMessage)
    .filter((message): message is ApiTranscriptMessage => message !== null);

  return normalized.length > 0 ? normalized : undefined;
}
