import { renderHook, waitFor } from '@testing-library/react';
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
    versions: [{ content, createdAt: timestamp, kind: 'original' as const, subsequentMessages: [] }],
    currentVersionIndex: 0,
  };
}

describe('useStableChatMessageDerivatives', () => {
  it('keeps derived references stable when only assistant text changes', async () => {
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
    await waitFor(() => expect(view.result.current.sentUserMessages).toEqual(['hello']));

    const firstImageGallery = view.result.current.imageGallery;
    const firstSentUserMessages = view.result.current.sentUserMessages;

    view.rerender({
      messages: [
        user,
        {
          ...assistant,
          content: 'first response extended',
          versions: [{ content: 'first response extended', createdAt: assistant.timestamp, kind: 'original' as const, subsequentMessages: [] }],
        },
      ],
    });

    expect(view.result.current.imageGallery).toBe(firstImageGallery);
    expect(view.result.current.sentUserMessages).toBe(firstSentUserMessages);
  });

  it('updates only the collection whose source data changed', async () => {
    const user = createMessage('u1', 'user', 'hello');
    const assistant = createMessage('a1', 'assistant', '![image](<https://example.com/1.png>)');
    const updatedAssistant = {
      ...assistant,
      content: '![image](<https://example.com/2.png>)',
      versions: [{ content: '![image](<https://example.com/2.png>)', createdAt: assistant.timestamp, kind: 'original' as const, subsequentMessages: [] }],
    };

    const view = renderHook(
      ({ messages }) => useStableChatMessageDerivatives(messages),
      {
        initialProps: {
          messages: [user, assistant] as ChatMessage[],
        },
      },
    );
    await waitFor(() => expect(view.result.current.imageGallery).toHaveLength(1));

    const firstImageGallery = view.result.current.imageGallery;
    const firstSentUserMessages = view.result.current.sentUserMessages;

    view.rerender({
      messages: [
        user,
        updatedAssistant,
      ],
    });

    await waitFor(() => expect(view.result.current.imageGallery).toEqual([
      { id: 'a1:0', src: 'https://example.com/2.png' },
    ]));
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

    await waitFor(() => expect(view.result.current.sentUserMessages).toEqual(['hello', 'follow up']));
    expect(view.result.current.imageGallery).toBe(secondImageGallery);
    expect(view.result.current.sentUserMessages).not.toBe(secondSentUserMessages);
  });

  it('keeps large data image sources out of the gallery signature', async () => {
    const user = createMessage('u1', 'user', 'hello');
    const assistant = createMessage('a1', 'assistant', `![image](<data:image/png;base64,${'a'.repeat(120_000)}>)`);

    const startedAt = performance.now();
    const view = renderHook(
      ({ messages }) => useStableChatMessageDerivatives(messages),
      {
        initialProps: {
          messages: [user, assistant] as ChatMessage[],
        },
      },
    );

    await waitFor(() => expect(view.result.current.imageGallery).toHaveLength(1));
    expect(view.result.current.imageGallery[0].src).toContain('data:image/png;base64,');
    expect(performance.now() - startedAt).toBeLessThan(250);
  });

  it('updates the gallery when same-length image sources differ after a long shared prefix', async () => {
    const prefix = `https://example.com/${'shared-path-'.repeat(10)}`;
    const firstSrc = `${prefix}A.png`;
    const secondSrc = `${prefix}B.png`;
    const assistant = createMessage('a1', 'assistant', `![image](<${firstSrc}>)`);

    const view = renderHook(
      ({ messages }) => useStableChatMessageDerivatives(messages),
      {
        initialProps: {
          messages: [assistant] as ChatMessage[],
        },
      },
    );
    await waitFor(() => expect(view.result.current.imageGallery).toHaveLength(1));
    const firstImageGallery = view.result.current.imageGallery;

    view.rerender({
      messages: [{
        ...assistant,
        content: `![image](<${secondSrc}>)`,
        versions: [{ content: `![image](<${secondSrc}>)`, createdAt: assistant.timestamp, kind: 'original' as const, subsequentMessages: [] }],
      }],
    });

    expect(firstSrc).toHaveLength(secondSrc.length);
    expect(firstSrc.slice(0, 96)).toBe(secondSrc.slice(0, 96));
    await waitFor(() => expect(view.result.current.imageGallery).toEqual([
      { id: 'a1:0', src: secondSrc },
    ]));
    expect(view.result.current.imageGallery).not.toBe(firstImageGallery);
  });

  it('updates sent user messages when same-length content differs after a long shared prefix', async () => {
    const prefix = 'shared text '.repeat(1000);
    const firstContent = `${prefix}A`;
    const secondContent = `${prefix}B`;
    const user = createMessage('u1', 'user', firstContent);

    const view = renderHook(
      ({ messages }) => useStableChatMessageDerivatives(messages),
      {
        initialProps: {
          messages: [user] as ChatMessage[],
        },
      },
    );
    await waitFor(() => expect(view.result.current.sentUserMessages).toEqual([firstContent]));
    const firstSentUserMessages = view.result.current.sentUserMessages;

    view.rerender({
      messages: [{
        ...user,
        content: secondContent,
        versions: [{ content: secondContent, createdAt: user.timestamp, kind: 'original' as const, subsequentMessages: [] }],
      }],
    });

    expect(firstContent).toHaveLength(secondContent.length);
    await waitFor(() => expect(view.result.current.sentUserMessages).toEqual([secondContent]));
    expect(view.result.current.sentUserMessages).not.toBe(firstSentUserMessages);
  });

  it('excludes non-renderable data images from the assistant gallery', async () => {
    const assistant = createMessage(
      'a1',
      'assistant',
      '![svg](<data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+>)\n\n![png](<data:image/png;base64,aGk=>)',
    );

    const view = renderHook(
      ({ messages }) => useStableChatMessageDerivatives(messages),
      {
        initialProps: {
          messages: [assistant] as ChatMessage[],
        },
      },
    );

    await waitFor(() => expect(view.result.current.imageGallery).toEqual([
      { id: 'a1:0', src: 'data:image/png;base64,aGk=' },
    ]));
  });

  it('excludes video image syntax from the assistant gallery', async () => {
    const assistant = createMessage(
      'a1',
      'assistant',
      [
        '![video](https://example.com/movie.mp4)',
        '<img src="https://example.com/clip.webm">',
        '![real](https://example.com/real.png)',
      ].join('\n'),
    );

    const view = renderHook(
      ({ messages }) => useStableChatMessageDerivatives(messages),
      {
        initialProps: {
          messages: [assistant] as ChatMessage[],
        },
      },
    );

    await waitFor(() => expect(view.result.current.imageGallery).toEqual([
      { id: 'a1:0', src: 'https://example.com/real.png' },
    ]));
  });

  it('excludes video URLs from known assistant image sources', async () => {
    const assistant = {
      ...createMessage('a1', 'assistant', ''),
      imageSources: [
        'https://example.com/movie.mp4',
        'https://example.com/real.png',
      ],
    };

    const view = renderHook(
      ({ messages }) => useStableChatMessageDerivatives(messages),
      {
        initialProps: {
          messages: [assistant] as ChatMessage[],
        },
      },
    );

    await waitFor(() => expect(view.result.current.imageGallery).toEqual([
      { id: 'a1:0', src: 'https://example.com/real.png' },
    ]));
  });

  it('ignores assistant image examples inside code blocks and inline code', async () => {
    const assistant = createMessage(
      'a1',
      'assistant',
      [
        '`![inline](https://example.com/inline.png)`',
        '```html',
        '<img src="https://example.com/code-html.png">',
        '![code](https://example.com/code.png)',
        '```',
        '![real](https://example.com/real.png)',
        '<img src="https://example.com/real-html.png">',
      ].join('\n'),
    );

    const view = renderHook(
      ({ messages }) => useStableChatMessageDerivatives(messages),
      {
        initialProps: {
          messages: [assistant] as ChatMessage[],
        },
      },
    );

    await waitFor(() => expect(view.result.current.imageGallery).toEqual([
      { id: 'a1:0', src: 'https://example.com/real.png' },
      { id: 'a1:1', src: 'https://example.com/real-html.png' },
    ]));
  });
});
