import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '@/lib/ai/types';
import {
  MAX_SESSION_MESSAGES_BYTES,
  serializeSessionMessages,
} from './chatStorage';

function createLargeMessage(id: string, timestamp: number): ChatMessage {
  return {
    id,
    role: 'user',
    content: 'x'.repeat(1024 * 1024),
    modelId: 'model-1',
    timestamp,
    versions: [],
    currentVersionIndex: 0,
  };
}

describe('chatStorage serialization budget', () => {
  it('keeps the newest messages when a session exceeds the storage byte limit', () => {
    const messages = Array.from({ length: 40 }, (_value, index) =>
      createLargeMessage(`m${index}`, index)
    );

    const serialized = serializeSessionMessages('session-1', messages);
    const payload = JSON.parse(serialized) as { messages: Array<{ id: string }> };
    const persistedIds = payload.messages.map((message) => message.id);

    expect(new TextEncoder().encode(serialized).byteLength).toBeLessThanOrEqual(MAX_SESSION_MESSAGES_BYTES);
    expect(persistedIds.length).toBeGreaterThan(0);
    expect(persistedIds.length).toBeLessThan(messages.length);
    expect(persistedIds).not.toContain('m0');
    expect(persistedIds.at(-1)).toBe('m39');
  });
});
