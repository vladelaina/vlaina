import type { ChatMessage } from '@/lib/ai/types';
import { estimateChatLoadingHeight } from './chatMessageLayout';
import {
  CHAT_MESSAGE_LIST_ACTIVE_OVERSCAN,
  CHAT_MESSAGE_LIST_BOTTOM_PADDING,
  CHAT_MESSAGE_LIST_GAP,
  CHAT_MESSAGE_LIST_OVERSCAN,
  CHAT_MESSAGE_LIST_TAIL_OVERSCAN,
  CHAT_MESSAGE_LIST_TOP_PADDING,
  CHAT_MESSAGE_LOADING_GAP,
  buildEstimatedChatMessageFrameLayout,
  type BuildChatMessageFrameLayoutOptions,
  type ChatMessageFrame,
  type ChatMessageFrameLayout,
} from './chatMessageFrameCache';

export {
  CHAT_MESSAGE_LIST_ACTIVE_OVERSCAN,
  CHAT_MESSAGE_LIST_BOTTOM_PADDING,
  CHAT_MESSAGE_LIST_GAP,
  CHAT_MESSAGE_LIST_OVERSCAN,
  CHAT_MESSAGE_LIST_TAIL_OVERSCAN,
  CHAT_MESSAGE_LIST_TOP_PADDING,
  CHAT_MESSAGE_LOADING_GAP,
  rememberMeasuredChatMessageHeight,
  restoreCachedMeasuredHeights,
} from './chatMessageFrameCache';
export type { ChatMessageFrame, ChatMessageFrameLayout } from './chatMessageFrameCache';

export function buildChatMessageFrameLayout(
  messages: ChatMessage[],
  {
    activeMessageId,
    cacheKey,
    containerWidth,
    fontSize,
    isSessionActive,
    measuredHeights,
  }: BuildChatMessageFrameLayoutOptions,
): ChatMessageFrameLayout {
  const estimatedLayout = buildEstimatedChatMessageFrameLayout(messages, {
    cacheKey,
    containerWidth,
    fontSize,
    isSessionActive,
  });

  if (!measuredHeights || measuredHeights.size === 0) {
    return estimatedLayout;
  }

  const items: ChatMessageFrame[] = [];
  let offset = CHAT_MESSAGE_LIST_TOP_PADDING;
  let hasMeasuredOverride = false;

  for (let index = 0; index < estimatedLayout.items.length; index += 1) {
    const frame = estimatedLayout.items[index]!;
    const message = messages[index]!;
    const measuredHeight = measuredHeights.get(frame.id);
    const measuredOverride = measuredHeight === undefined
      ? frame.height
      : Math.max(1, Math.ceil(measuredHeight));
    const isActiveAssistant =
      isSessionActive &&
      message.role === 'assistant' &&
      (activeMessageId === undefined
        ? index === estimatedLayout.items.length - 1
        : message.id === activeMessageId);
    const height = isActiveAssistant
      ? Math.max(frame.height, measuredOverride)
      : measuredOverride;

    if (height !== frame.height) {
      hasMeasuredOverride = true;
    }

    const top = offset;
    const bottom = top + height;
    items.push({
      bottom,
      height,
      id: frame.id,
      index: frame.index,
      top,
    });

    offset = bottom;
    if (index < estimatedLayout.items.length - 1) {
      offset += CHAT_MESSAGE_LIST_GAP;
    }
  }

  if (!hasMeasuredOverride) {
    return estimatedLayout;
  }

  return {
    endOffset: offset,
    items,
  };
}

export function findVisibleChatMessageRange(
  items: ChatMessageFrame[],
  scrollTop: number,
  viewportHeight: number,
  overscan: number = CHAT_MESSAGE_LIST_OVERSCAN,
): {
  end: number;
  start: number;
} {
  if (items.length === 0) {
    return { start: 0, end: 0 };
  }

  const minY = Math.max(0, scrollTop - overscan);
  const maxY = Math.max(minY, scrollTop + viewportHeight + overscan);

  let low = 0;
  let high = items.length;

  while (low < high) {
    const mid = (low + high) >> 1;
    if (items[mid]!.bottom > minY) {
      high = mid;
    } else {
      low = mid + 1;
    }
  }

  const start = low;
  low = start;
  high = items.length;

  while (low < high) {
    const mid = (low + high) >> 1;
    if (items[mid]!.top >= maxY) {
      high = mid;
    } else {
      low = mid + 1;
    }
  }

  return {
    start,
    end: low,
  };
}

export function resolveChatMessageListOverscan({
  anchorTail = false,
  isSessionActive = false,
  viewportHeight,
}: {
  anchorTail?: boolean;
  isSessionActive?: boolean;
  viewportHeight: number;
}): number {
  if (viewportHeight <= 0) {
    return CHAT_MESSAGE_LIST_OVERSCAN;
  }

  if (anchorTail) {
    return Math.min(
      CHAT_MESSAGE_LIST_TAIL_OVERSCAN,
      Math.max(96, Math.ceil(viewportHeight * 0.5)),
    );
  }

  if (isSessionActive) {
    return Math.min(
      CHAT_MESSAGE_LIST_ACTIVE_OVERSCAN,
      Math.max(160, Math.ceil(viewportHeight * 0.75)),
    );
  }

  return CHAT_MESSAGE_LIST_OVERSCAN;
}

export function resolveVisibleChatMessageRange(
  items: ChatMessageFrame[],
  {
    anchorTail = false,
    overscan = CHAT_MESSAGE_LIST_OVERSCAN,
    scrollTop,
    viewportHeight,
  }: {
    anchorTail?: boolean;
    overscan?: number;
    scrollTop: number;
    viewportHeight: number;
  },
): {
  end: number;
  start: number;
} {
  if (viewportHeight <= 0 || items.length === 0) {
    return {
      start: 0,
      end: items.length,
    };
  }

  if (!anchorTail) {
    return findVisibleChatMessageRange(items, scrollTop, viewportHeight, overscan);
  }

  const anchoredScrollTop = Math.max(0, items[items.length - 1]!.bottom - viewportHeight);
  const anchoredRange = findVisibleChatMessageRange(items, anchoredScrollTop, viewportHeight, overscan);
  return {
    start: anchoredRange.start,
    end: items.length,
  };
}

export function buildTrailingChatLayout(
  messageLayout: ChatMessageFrameLayout,
  showLoading: boolean,
  spacerHeight: number,
): {
  loadingTop: number | null;
  spacerTop: number | null;
  totalHeight: number;
} {
  let offset = messageLayout.endOffset;
  const hasMessages = messageLayout.items.length > 0;
  let loadingTop: number | null = null;
  let spacerTop: number | null = null;

  if (showLoading) {
    if (hasMessages) {
      offset += CHAT_MESSAGE_LOADING_GAP;
    }
    loadingTop = offset;
    offset += estimateChatLoadingHeight();
  }

  if (spacerHeight > 0) {
    if (hasMessages || showLoading) {
      offset += CHAT_MESSAGE_LIST_GAP;
    }
    spacerTop = offset;
    offset += spacerHeight;
  }

  return {
    loadingTop,
    spacerTop,
    totalHeight: offset + CHAT_MESSAGE_LIST_BOTTOM_PADDING,
  };
}
