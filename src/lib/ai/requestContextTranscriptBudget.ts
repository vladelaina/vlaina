import type { ApiTranscriptMessage, ChatMessage, ChatMessageContent } from './types';
import { MAX_TRANSCRIPT_FIELD_CHARS, clipContentToBudget } from './requestContextLimits';
import { measureRequestJsonLength } from './requestContextJsonBudget';

function clipTranscriptContent(content: ChatMessageContent | null | undefined): ChatMessageContent | null | undefined {
  if (typeof content !== 'string') {
    return content;
  }

  return clipContentToBudget(content, MAX_TRANSCRIPT_FIELD_CHARS);
}

function compactTranscriptMessage(message: ApiTranscriptMessage): ApiTranscriptMessage {
  const content = clipTranscriptContent(message.content);
  return {
    ...message,
    content: message.role === 'assistant' && content == null && (message.reasoning_content || message.tool_calls?.length)
      ? ''
      : content,
    ...(typeof message.reasoning_content === 'string'
      ? { reasoning_content: clipContentToBudget(message.reasoning_content, MAX_TRANSCRIPT_FIELD_CHARS) }
      : {}),
  };
}

function compactApiTranscriptToBudget(
  transcript: ApiTranscriptMessage[],
  maxChars: number
): ApiTranscriptMessage[] | undefined {
  if (measureRequestJsonLength(transcript, maxChars) <= maxChars) {
    return transcript;
  }

  const compacted = transcript.map(compactTranscriptMessage);
  if (measureRequestJsonLength(compacted, maxChars) <= maxChars) {
    return compacted;
  }

  const finalAssistant = [...compacted].reverse().find((message) =>
    message.role === 'assistant' && (message.content != null || message.reasoning_content)
  );
  if (!finalAssistant) {
    return undefined;
  }

  const minimal: ApiTranscriptMessage = {
    role: 'assistant',
    content: clipTranscriptContent(finalAssistant.content) ?? '',
    ...(finalAssistant.reasoning_content
      ? { reasoning_content: clipContentToBudget(finalAssistant.reasoning_content, MAX_TRANSCRIPT_FIELD_CHARS) }
      : {}),
  };

  return measureRequestJsonLength([minimal], maxChars) <= maxChars ? [minimal] : undefined;
}

export function clipTranscriptToBudget<T extends ChatMessage>(message: T, maxChars: number): T {
  if (!message.apiTranscript) {
    return message;
  }

  const apiTranscript = compactApiTranscriptToBudget(message.apiTranscript, maxChars);
  if (apiTranscript) {
    return {
      ...message,
      apiTranscript,
    };
  }

  const { apiTranscript: _apiTranscript, ...rest } = message;
  return rest as T;
}
