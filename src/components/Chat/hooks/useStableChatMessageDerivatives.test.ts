import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '@/lib/ai/types';
import { useStableChatMessageDerivatives } from './useStableChatMessageDerivatives';

function createMessage(id: string, role: ChatMessage['role'], content: string): ChatMessage {
  const timestamp = Date.now();
  return {
    id,
    role,
    content,
    modelId: 'model-a',
    timestamp,
    versions: [{ content, createdAt: timestamp, subsequentMessages: [] }],
    currentVersionIndex: 0,
  };
}

describe('useStableChatMessageDerivatives', () => {
  it('keeps derived references stable when only assistant text changes', () => {
    const user = createMessage('u1', 'user', 'hello');
    const assistant = createMessage('a1', 'assistant', 'first response');

    const view = renderHook(
      ({ messages }) => useStableChatMessageDerivatives(messages),
      {
        initialProps: {
          messages: [user, assistant] as ChatMessage[],
        },
      },
    );

    const firstImageGallery = view.result.current.imageGallery;
    const firstSentUserMessages = view.result.current.sentUserMessages;

    view.rerender({
      messages: [
        user,
        {
          ...assistant,
          content: 'first response extended',
          versions: [{ content: 'first response extended', createdAt: assistant.timestamp, subsequentMessages: [] }],
        },
      ],
    });

    expect(view.result.current.imageGallery).toBe(firstImageGallery);
    expect(view.result.current.sentUserMessages).toBe(firstSentUserMessages);
  });

  it('updates only the collection whose source data changed', () => {
    const user = createMessage('u1', 'user', 'hello');
    const assistant = createMessage('a1', 'assistant', '![image](<https://example.com/1.png>)');
    const updatedAssistant = {
      ...assistant,
      content: '![image](<https://example.com/2.png>)',
      versions: [{ content: '![image](<https://example.com/2.png>)', createdAt: assistant.timestamp, subsequentMessages: [] }],
    };

    const view = renderHook(
      ({ messages }) => useStableChatMessageDerivatives(messages),
      {
        initialProps: {
          messages: [user, assistant] as ChatMessage[],
        },
      },
    );

    const firstImageGallery = view.result.current.imageGallery;
    const firstSentUserMessages = view.result.current.sentUserMessages;

    view.rerender({
      messages: [
        user,
        updatedAssistant,
      ],
    });

    expect(view.result.current.imageGallery).not.toBe(firstImageGallery);
    expect(view.result.current.sentUserMessages).toBe(firstSentUserMessages);

    const secondImageGallery = view.result.current.imageGallery;
    const secondSentUserMessages = view.result.current.sentUserMessages;

    view.rerender({
      messages: [
        user,
        updatedAssistant,
        createMessage('u2', 'user', 'follow up'),
      ],
    });

    expect(view.result.current.imageGallery).toBe(secondImageGallery);
    expect(view.result.current.sentUserMessages).not.toBe(secondSentUserMessages);
  });
});
