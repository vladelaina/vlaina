import type { ChatMessage } from '@/lib/ai/types';
import { parseErrorTag, stripFirstErrorTag } from '@/lib/ai/errorTag';
import { isManagedModelId } from '@/lib/ai/managedService';
import { stripThinkingContent } from '@/lib/ai/stripThinkingContent';
import type { RenderedMessageRow, RenderedMessageState } from './MessageListTypes';

function isPureManagedAuthErrorMessage(message: ChatMessage): boolean {
  const parsedError = parseErrorTag(message.content);
  if (parsedError?.type !== 'AUTH_ERROR' || !isManagedModelId(message.modelId)) {
    return false;
  }

  const contentWithoutError = stripFirstErrorTag(message.content);
  return stripThinkingContent(contentWithoutError).trim().length === 0;
}

export function buildRenderedMessageState(messages: ChatMessage[]): RenderedMessageState {
  const rows: RenderedMessageRow[] = [];
  const renderedMessages: ChatMessage[] = [];
  const ids = new Set<string>();
  const messageById = new Map<string, ChatMessage>();
  let latestManagedAuthErrorIndex = -1;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (isPureManagedAuthErrorMessage(messages[index]!)) {
      latestManagedAuthErrorIndex = index;
      break;
    }
  }

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index]!;
    if (index !== latestManagedAuthErrorIndex && isPureManagedAuthErrorMessage(message)) {
      continue;
    }

    rows.push({ message, originalIndex: index });
    renderedMessages.push(message);
    ids.add(message.id);
    messageById.set(message.id, message);
  }

  return {
    ids,
    messageById,
    messages: renderedMessages,
    rows,
  };
}

export function areMeasuredHeightsEqual(
  left: Map<string, number>,
  right: Map<string, number>,
): boolean {
  if (left.size !== right.size) {
    return false;
  }

  for (const [key, value] of left) {
    if (right.get(key) !== value) {
      return false;
    }
  }

  return true;
}
