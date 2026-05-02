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

  it('does not reserve user toolbar height while waiting for a response', () => {
    const message = createMessage('user', 'short');
    const idleHeight = estimateChatMessageHeight(message, {
      containerWidth: 900,
      isStreaming: false,
    });
    const waitingHeight = estimateChatMessageHeight(message, {
      containerWidth: 900,
      isStreaming: true,
    });

    expect(waitingHeight).toBeLessThan(idleHeight);
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

  it('accounts for headings, lists, and blockquotes as separate blocks', () => {
    const plainHeight = estimateChatMessageHeight(
      createMessage('assistant', 'hello world'),
      { containerWidth: 900, isStreaming: false },
    );
    const structuredHeight = estimateChatMessageHeight(
      createMessage(
        'assistant',
        '# Title\n\n- first item\n- second item\n\n> quoted line',
      ),
      { containerWidth: 900, isStreaming: false },
    );

    expect(structuredHeight).toBeGreaterThan(plainHeight);
  });

  it('treats markdown tables as code-like blocks for measurement', () => {
    const plainHeight = estimateChatMessageHeight(
      createMessage('assistant', 'alpha beta'),
      { containerWidth: 900, isStreaming: false },
    );
    const tableHeight = estimateChatMessageHeight(
      createMessage(
        'assistant',
        '| a | b |\n| --- | --- |\n| 1 | 2 |\n| 3 | 4 |',
      ),
      { containerWidth: 900, isStreaming: false },
    );

    expect(tableHeight).toBeGreaterThan(plainHeight);
  });

  it('accounts for inline links and code spans in narrow assistant layouts', () => {
    const plainHeight = estimateChatMessageHeight(
      createMessage('assistant', 'Open link and code sample now'),
      { containerWidth: 360, isStreaming: false },
    );
    const richInlineHeight = estimateChatMessageHeight(
      createMessage('assistant', 'Open [link destination](https://example.com) and `code sample` now'),
      { containerWidth: 360, isStreaming: false },
    );

    expect(richInlineHeight).toBeGreaterThanOrEqual(plainHeight);
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

  it('keeps streaming assistant height monotonic as content is appended on the same message', () => {
    const first = createMessage('assistant', '## Title\n\nFirst paragraph');
    const second = {
      ...first,
      content: '## Title\n\nFirst paragraph\n\n- item one\n- item two',
      versions: [{
        content: '## Title\n\nFirst paragraph\n\n- item one\n- item two',
        createdAt: first.timestamp,
        subsequentMessages: [],
      }],
    };

    const firstHeight = estimateChatMessageHeight(first, {
      containerWidth: 900,
      isStreaming: true,
    });
    const secondHeight = estimateChatMessageHeight(second, {
      containerWidth: 900,
      isStreaming: true,
    });

    expect(secondHeight).toBeGreaterThanOrEqual(firstHeight);
  });

  it('matches cold parsing when streaming content is incrementally appended on the same message', () => {
    const base = createMessage('assistant', '## Title\n\nFirst paragraph');
    const streamed = {
      ...base,
      content: '## Title\n\nFirst paragraph\n\n- item one\n- item two\n\n```ts\nconst value = 1;\n```',
      versions: [{
        content: '## Title\n\nFirst paragraph\n\n- item one\n- item two\n\n```ts\nconst value = 1;\n```',
        createdAt: base.timestamp,
        subsequentMessages: [],
      }],
    };
    const cold = createMessage(
      'assistant',
      '## Title\n\nFirst paragraph\n\n- item one\n- item two\n\n```ts\nconst value = 1;\n```',
    );

    estimateChatMessageHeight(base, {
      containerWidth: 900,
      isStreaming: true,
    });
    const streamedHeight = estimateChatMessageHeight(streamed, {
      containerWidth: 900,
      isStreaming: true,
    });
    const coldHeight = estimateChatMessageHeight(cold, {
      containerWidth: 900,
      isStreaming: true,
    });

    expect(streamedHeight).toBe(coldHeight);
  });
});
