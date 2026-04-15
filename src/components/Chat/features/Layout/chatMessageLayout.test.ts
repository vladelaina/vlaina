import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '@/lib/ai/types';
import {
  estimateChatMessageHeight,
} from './chatMessageLayout';

function createMessage(role: ChatMessage['role'], content: string): ChatMessage {
  const timestamp = Date.now();
  return {
    id: `${role}-${timestamp}`,
    role,
    content,
    modelId: 'model-a',
    timestamp,
    versions: [{ content, createdAt: timestamp, subsequentMessages: [] }],
    currentVersionIndex: 0,
  };
}

describe('estimateChatMessageHeight', () => {
  it('grows for longer user messages', () => {
    const shortHeight = estimateChatMessageHeight(
      createMessage('user', 'short'),
      { containerWidth: 900, isStreaming: false },
    );
    const longHeight = estimateChatMessageHeight(
      createMessage('user', 'long '.repeat(120)),
      { containerWidth: 900, isStreaming: false },
    );

    expect(longHeight).toBeGreaterThan(shortHeight);
  });

  it('accounts for assistant code fences and images', () => {
    const plainHeight = estimateChatMessageHeight(
      createMessage('assistant', 'hello world'),
      { containerWidth: 900, isStreaming: false },
    );
    const richHeight = estimateChatMessageHeight(
      createMessage(
        'assistant',
        '```ts\nconst a = 1;\nconst b = 2;\n```\n\n![image](<https://example.com/x.png>)',
      ),
      { containerWidth: 900, isStreaming: false },
    );

    expect(richHeight).toBeGreaterThan(plainHeight);
  });

  it('expands active thinking content while streaming', () => {
    const idleHeight = estimateChatMessageHeight(
      createMessage('assistant', '<think>first step\nsecond step</think>processing result'),
      { containerWidth: 900, isStreaming: false },
    );
    const streamingHeight = estimateChatMessageHeight(
      createMessage('assistant', '<think>first step\nsecond step</think>processing result'),
      { containerWidth: 900, isStreaming: true },
    );

    expect(streamingHeight).toBeGreaterThan(idleHeight);
  });
});
