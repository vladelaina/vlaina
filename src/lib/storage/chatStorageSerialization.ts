import type { ChatMessage } from '@/lib/ai/types';
import {
  MAX_SESSION_MESSAGES_BYTES,
  SESSION_MESSAGES_FILE_VERSION,
} from './chatStorageLimits';
import { normalizeSessionMessages } from './chatStorageNormalization';
import { assertSafeChatSessionId } from './chatStorageSessionId';

interface SessionMessagesFile {
  version: typeof SESSION_MESSAGES_FILE_VERSION;
  sessionId: string;
  updatedAt: number;
  messages: ChatMessage[];
}

export function serializeSessionMessages(sessionId: string, messages: ChatMessage[]): string {
  assertSafeChatSessionId(sessionId);
  return serializeBoundedSessionMessages(sessionId, normalizeSessionMessages(messages));
}

function stringifySessionMessagesPayload(sessionId: string, messages: ChatMessage[]): string {
  const payload: SessionMessagesFile = {
    version: SESSION_MESSAGES_FILE_VERSION,
    sessionId,
    updatedAt: Date.now(),
    messages,
  };
  return JSON.stringify(payload, null, 2);
}

function getBoundedUtf8ByteLength(value: string, maxBytes: number): number {
  let bytes = 0;

  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x7f) {
      bytes += 1;
    } else if (code <= 0x7ff) {
      bytes += 2;
    } else if (
      code >= 0xd800 &&
      code <= 0xdbff &&
      index + 1 < value.length
    ) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        index += 1;
      } else {
        bytes += 3;
      }
    } else {
      bytes += 3;
    }

    if (bytes > maxBytes) {
      return maxBytes + 1;
    }
  }

  return bytes;
}

export function isWithinSessionMessagesByteLimit(value: string): boolean {
  return getBoundedUtf8ByteLength(value, MAX_SESSION_MESSAGES_BYTES) <= MAX_SESSION_MESSAGES_BYTES;
}

function serializeBoundedSessionMessages(sessionId: string, messages: ChatMessage[]): string {
  let best = stringifySessionMessagesPayload(sessionId, []);
  if (messages.length === 0) return best;

  let lastFit = 0;
  let nextCount = 1;
  while (nextCount <= messages.length) {
    const candidate = stringifySessionMessagesPayload(sessionId, messages.slice(messages.length - nextCount));
    if (!isWithinSessionMessagesByteLimit(candidate)) {
      break;
    }
    best = candidate;
    lastFit = nextCount;
    nextCount *= 2;
  }

  if (lastFit === messages.length) {
    return best;
  }

  let low = lastFit + 1;
  let high = Math.min(nextCount - 1, messages.length);
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const candidate = stringifySessionMessagesPayload(sessionId, messages.slice(messages.length - mid));
    if (isWithinSessionMessagesByteLimit(candidate)) {
      best = candidate;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return best;
}
