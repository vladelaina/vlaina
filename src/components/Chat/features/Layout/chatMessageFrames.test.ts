import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '@/lib/ai/types';
import {
  buildChatMessageFrameLayout,
  buildTrailingChatLayout,
  CHAT_MESSAGE_LOADING_GAP,
  CHAT_MESSAGE_LIST_ACTIVE_OVERSCAN,
  CHAT_MESSAGE_LIST_BOTTOM_PADDING,
  CHAT_MESSAGE_LIST_GAP,
  CHAT_MESSAGE_LIST_TOP_PADDING,
  CHAT_MESSAGE_LIST_TAIL_OVERSCAN,
  findVisibleChatMessageRange,
  rememberMeasuredChatMessageHeight,
  resolveChatMessageListOverscan,
  resolveVisibleChatMessageRange,
  restoreCachedMeasuredHeights,
} from './chatMessageFrames';

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

describe('chatMessageFrames', () => {
  it('builds sequential message frames with measured height overrides', () => {
    const messages = [
      createMessage('u1', 'user', 'hello'),
      createMessage('a1', 'assistant', 'world'),
    ];
    const measuredHeights = new Map<string, number>([
      ['u1', 120],
      ['a1', 180],
    ]);

    const layout = buildChatMessageFrameLayout(messages, {
      containerWidth: 900,
      isSessionActive: false,
      measuredHeights,
    });

    expect(layout.items).toHaveLength(2);
    expect(layout.items[0]).toMatchObject({
      id: 'u1',
      index: 0,
      top: CHAT_MESSAGE_LIST_TOP_PADDING,
      height: 120,
      bottom: CHAT_MESSAGE_LIST_TOP_PADDING + 120,
    });
    expect(layout.items[1]).toMatchObject({
      id: 'a1',
      index: 1,
      top: CHAT_MESSAGE_LIST_TOP_PADDING + 120 + CHAT_MESSAGE_LIST_GAP,
      height: 180,
      bottom: CHAT_MESSAGE_LIST_TOP_PADDING + 120 + CHAT_MESSAGE_LIST_GAP + 180,
    });
    expect(layout.endOffset).toBe(CHAT_MESSAGE_LIST_TOP_PADDING + 120 + CHAT_MESSAGE_LIST_GAP + 180);
  });

  it('reuses cached estimated layouts for the same session and width', () => {
    const messages = [
      createMessage('u1', 'user', 'hello'),
      createMessage('a1', 'assistant', 'world'),
    ];

    const first = buildChatMessageFrameLayout(messages, {
      cacheKey: 'chat-1',
      containerWidth: 900,
      isSessionActive: false,
    });
    const second = buildChatMessageFrameLayout(messages, {
      cacheKey: 'chat-1',
      containerWidth: 900,
      isSessionActive: false,
    });

    expect(second).toBe(first);
  });

  it('reuses cached estimated layouts across nearby widths in the same bucket', () => {
    const messages = [
      createMessage('u1', 'user', 'hello'),
      createMessage('a1', 'assistant', 'world'),
    ];

    const first = buildChatMessageFrameLayout(messages, {
      cacheKey: 'chat-bucket',
      containerWidth: 721,
      isSessionActive: false,
    });
    const second = buildChatMessageFrameLayout(messages, {
      cacheKey: 'chat-bucket',
      containerWidth: 727,
      isSessionActive: false,
    });

    expect(second).toBe(first);
  });

  it('reuses the unchanged prefix when only the last message changes', () => {
    const firstMessages = [
      createMessage('u1', 'user', 'hello'),
      createMessage('a1', 'assistant', 'stream'),
    ];
    const secondMessages = [
      firstMessages[0]!,
      {
        ...firstMessages[1]!,
        content: 'stream updated',
        versions: [{ content: 'stream updated', createdAt: firstMessages[1]!.timestamp, subsequentMessages: [] }],
      },
    ];

    const first = buildChatMessageFrameLayout(firstMessages, {
      cacheKey: 'chat-stream',
      containerWidth: 900,
      isSessionActive: true,
    });
    const second = buildChatMessageFrameLayout(secondMessages, {
      cacheKey: 'chat-stream',
      containerWidth: 900,
      isSessionActive: true,
    });

    expect(second).not.toBe(first);
    expect(second.items[0]).toBe(first.items[0]);
    expect(second.items[1]).not.toBe(first.items[1]);
  });

  it('reuses all existing frames when a new message is appended', () => {
    const firstMessages = [
      createMessage('u1', 'user', 'hello'),
      createMessage('a1', 'assistant', 'world'),
    ];
    const secondMessages = [
      ...firstMessages,
      createMessage('a2', 'assistant', 'new tail'),
    ];

    const first = buildChatMessageFrameLayout(firstMessages, {
      cacheKey: 'chat-append',
      containerWidth: 900,
      isSessionActive: false,
    });
    const second = buildChatMessageFrameLayout(secondMessages, {
      cacheKey: 'chat-append',
      containerWidth: 900,
      isSessionActive: false,
    });

    expect(second.items).toHaveLength(3);
    expect(second.items[0]).toBe(first.items[0]);
    expect(second.items[1]).toBe(first.items[1]);
  });

  it('finds a visible message slice using binary search', () => {
    const layout = {
      endOffset: 612,
      items: [
        { id: 'm1', index: 0, top: 32, bottom: 132, height: 100 },
        { id: 'm2', index: 1, top: 164, bottom: 304, height: 140 },
        { id: 'm3', index: 2, top: 336, bottom: 456, height: 120 },
        { id: 'm4', index: 3, top: 488, bottom: 612, height: 124 },
      ],
    };

    expect(findVisibleChatMessageRange(layout.items, 150, 180, 0)).toEqual({
      start: 1,
      end: 2,
    });
  });

  it('anchors the visible range to the tail when requested', () => {
    const items = [
      { id: 'm1', index: 0, top: 32, bottom: 132, height: 100 },
      { id: 'm2', index: 1, top: 164, bottom: 304, height: 140 },
      { id: 'm3', index: 2, top: 336, bottom: 456, height: 120 },
      { id: 'm4', index: 3, top: 488, bottom: 612, height: 124 },
    ];

    expect(
      resolveVisibleChatMessageRange(items, {
        anchorTail: true,
        scrollTop: 40,
        viewportHeight: 180,
        overscan: 0,
      }),
    ).toEqual({
      start: 2,
      end: 4,
    });
  });

  it('resolves tighter overscan values for active and tail-anchored states', () => {
    expect(resolveChatMessageListOverscan({
      viewportHeight: 0,
    })).toBe(480);

    expect(resolveChatMessageListOverscan({
      isSessionActive: true,
      viewportHeight: 600,
    })).toBe(CHAT_MESSAGE_LIST_ACTIVE_OVERSCAN);

    expect(resolveChatMessageListOverscan({
      anchorTail: true,
      isSessionActive: true,
      viewportHeight: 600,
    })).toBe(CHAT_MESSAGE_LIST_TAIL_OVERSCAN);
  });

  it('uses smaller overscan to tighten the visible slice', () => {
    const items = [
      { id: 'm1', index: 0, top: 0, bottom: 100, height: 100 },
      { id: 'm2', index: 1, top: 132, bottom: 232, height: 100 },
      { id: 'm3', index: 2, top: 264, bottom: 364, height: 100 },
      { id: 'm4', index: 3, top: 396, bottom: 496, height: 100 },
      { id: 'm5', index: 4, top: 528, bottom: 628, height: 100 },
      { id: 'm6', index: 5, top: 660, bottom: 760, height: 100 },
    ];

    expect(findVisibleChatMessageRange(items, 300, 120, 480)).toEqual({
      start: 0,
      end: 6,
    });

    expect(findVisibleChatMessageRange(items, 300, 120, 96)).toEqual({
      start: 1,
      end: 4,
    });
  });

  it('restores cached measured heights for the same session and width', () => {
    const message = createMessage('u1', 'user', 'hello world');
    rememberMeasuredChatMessageHeight(message, {
      cacheKey: 'chat-1',
      containerWidth: 900,
      isSessionActive: false,
      height: 144,
    });

    const restored = restoreCachedMeasuredHeights([message], {
      cacheKey: 'chat-1',
      containerWidth: 900,
      isSessionActive: false,
    });

    expect(restored.get('u1')).toBe(144);
  });

  it('restores cached measured heights across nearby widths in the same bucket', () => {
    const message = createMessage('u2', 'assistant', 'hello world');
    rememberMeasuredChatMessageHeight(message, {
      cacheKey: 'chat-3',
      containerWidth: 721,
      isSessionActive: false,
      height: 188,
    });

    const restored = restoreCachedMeasuredHeights([message], {
      cacheKey: 'chat-3',
      containerWidth: 727,
      isSessionActive: false,
    });

    expect(restored.get('u2')).toBe(188);
  });

  it('invalidates cached measured heights when the message signature changes', () => {
    const first = createMessage('u1', 'user', 'first version');
    rememberMeasuredChatMessageHeight(first, {
      cacheKey: 'chat-2',
      containerWidth: 900,
      isSessionActive: false,
      height: 132,
    });

    const updated = {
      ...first,
      content: 'second version',
      currentVersionIndex: 1,
      versions: [
        ...first.versions,
        { content: 'second version', createdAt: first.timestamp + 1, subsequentMessages: [] },
      ],
    };

    const restored = restoreCachedMeasuredHeights([updated], {
      cacheKey: 'chat-2',
      containerWidth: 900,
      isSessionActive: false,
    });

    expect(restored.has('u1')).toBe(false);
  });

  it('does not restore measured heights across idle and active session states', () => {
    const message = createMessage('u1', 'user', 'hello world');
    rememberMeasuredChatMessageHeight(message, {
      cacheKey: 'chat-4',
      containerWidth: 900,
      isSessionActive: false,
      height: 144,
    });

    const restored = restoreCachedMeasuredHeights([message], {
      cacheKey: 'chat-4',
      containerWidth: 900,
      isSessionActive: true,
    });

    expect(restored.has('u1')).toBe(false);
  });

  it('builds trailing layout for loading and spacer blocks after messages', () => {
    const messageLayout = {
      endOffset: CHAT_MESSAGE_LIST_TOP_PADDING + 240,
      items: [{ id: 'm1', index: 0, top: CHAT_MESSAGE_LIST_TOP_PADDING, bottom: CHAT_MESSAGE_LIST_TOP_PADDING + 240, height: 240 }],
    };

    const trailing = buildTrailingChatLayout(messageLayout, true, 96);

    expect(trailing.loadingTop).toBe(CHAT_MESSAGE_LIST_TOP_PADDING + 240 + CHAT_MESSAGE_LOADING_GAP);
    expect(trailing.spacerTop).toBe(
      CHAT_MESSAGE_LIST_TOP_PADDING + 240 + CHAT_MESSAGE_LOADING_GAP + 24 + CHAT_MESSAGE_LIST_GAP,
    );
    expect(trailing.totalHeight).toBe(
      CHAT_MESSAGE_LIST_TOP_PADDING + 240 + CHAT_MESSAGE_LOADING_GAP + 24 + CHAT_MESSAGE_LIST_GAP + 96 + CHAT_MESSAGE_LIST_BOTTOM_PADDING,
    );
  });
});
