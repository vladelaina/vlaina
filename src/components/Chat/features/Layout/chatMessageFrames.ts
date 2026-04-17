import type { ChatMessage } from '@/lib/ai/types';
import { estimateChatMessageHeight, estimateChatLoadingHeight } from './chatMessageLayout';
import { normalizeChatContainerWidth } from './chatWidthBuckets';

export const CHAT_MESSAGE_LIST_GAP = 32;
export const CHAT_MESSAGE_LIST_TOP_PADDING = 32;
export const CHAT_MESSAGE_LIST_BOTTOM_PADDING = 16;
export const CHAT_MESSAGE_LIST_OVERSCAN = 480;
export const CHAT_MESSAGE_LIST_ACTIVE_OVERSCAN = 320;
export const CHAT_MESSAGE_LIST_TAIL_OVERSCAN = 160;

export interface ChatMessageFrame {
  bottom: number;
  height: number;
  id: string;
  index: number;
  top: number;
}

export interface ChatMessageFrameLayout {
  endOffset: number;
  items: ChatMessageFrame[];
}

interface BuildChatMessageFrameLayoutOptions {
  cacheKey?: string | null;
  containerWidth: number;
  isSessionActive: boolean;
  measuredHeights?: Map<string, number>;
}

type CachedFrameLayoutEntry = {
  layout: ChatMessageFrameLayout;
  messageSignatures: string[];
  signature: string;
};

type CachedMeasuredHeightEntry = {
  height: number;
  signature: string;
};

const FRAME_LAYOUT_CACHE_LIMIT = 24;
const MEASURED_HEIGHT_CACHE_LIMIT = 2000;
const estimatedFrameLayoutCache = new Map<string, CachedFrameLayoutEntry>();
const measuredHeightCache = new Map<string, CachedMeasuredHeightEntry>();

function setEstimatedFrameLayoutCacheEntry(
  key: string,
  entry: CachedFrameLayoutEntry,
): void {
  if (estimatedFrameLayoutCache.has(key)) {
    estimatedFrameLayoutCache.delete(key);
  } else if (estimatedFrameLayoutCache.size >= FRAME_LAYOUT_CACHE_LIMIT) {
    const oldestKey = estimatedFrameLayoutCache.keys().next().value;
    if (oldestKey !== undefined) {
      estimatedFrameLayoutCache.delete(oldestKey);
    }
  }

  estimatedFrameLayoutCache.set(key, entry);
}

function setMeasuredHeightCacheEntry(
  key: string,
  entry: CachedMeasuredHeightEntry,
): void {
  if (measuredHeightCache.has(key)) {
    measuredHeightCache.delete(key);
  } else if (measuredHeightCache.size >= MEASURED_HEIGHT_CACHE_LIMIT) {
    const oldestKey = measuredHeightCache.keys().next().value;
    if (oldestKey !== undefined) {
      measuredHeightCache.delete(oldestKey);
    }
  }

  measuredHeightCache.set(key, entry);
}

function getFrameLayoutCacheKey(
  cacheKey: string | null | undefined,
  containerWidth: number,
  isSessionActive: boolean,
): string {
  return `${cacheKey ?? 'sessionless'}\u0000${containerWidth}\u0000${isSessionActive ? 1 : 0}`;
}

function getMessageSignature(message: ChatMessage): string {
  return `${message.id}\u0000${message.currentVersionIndex}\u0000${message.role}\u0000${message.content}`;
}

function getMessageSignatures(messages: ChatMessage[]): string[] {
  return messages.map((message) => getMessageSignature(message));
}

function getSharedMessagePrefixLength(
  previous: string[],
  next: string[],
): number {
  const maxLength = Math.min(previous.length, next.length);
  let index = 0;

  while (index < maxLength && previous[index] === next[index]) {
    index += 1;
  }

  return index;
}

function getMeasuredHeightCacheKey(
  cacheKey: string | null | undefined,
  containerWidth: number,
  messageId: string,
): string {
  return `${cacheKey ?? 'sessionless'}\u0000${containerWidth}\u0000${messageId}`;
}

export function restoreCachedMeasuredHeights(
  messages: ChatMessage[],
  {
    cacheKey,
    containerWidth,
  }: Pick<BuildChatMessageFrameLayoutOptions, 'cacheKey' | 'containerWidth'>,
): Map<string, number> {
  const normalizedWidth = normalizeChatContainerWidth(containerWidth);
  const restored = new Map<string, number>();

  for (const message of messages) {
    const key = getMeasuredHeightCacheKey(cacheKey, normalizedWidth, message.id);
    const cached = measuredHeightCache.get(key);
    if (!cached || cached.signature !== getMessageSignature(message)) {
      continue;
    }

    measuredHeightCache.delete(key);
    measuredHeightCache.set(key, cached);
    restored.set(message.id, cached.height);
  }

  return restored;
}

export function rememberMeasuredChatMessageHeight(
  message: ChatMessage,
  {
    cacheKey,
    containerWidth,
    height,
  }: Pick<BuildChatMessageFrameLayoutOptions, 'cacheKey' | 'containerWidth'> & { height: number },
): void {
  const normalizedWidth = normalizeChatContainerWidth(containerWidth);
  const normalizedHeight = Math.max(1, Math.ceil(height));
  setMeasuredHeightCacheEntry(
    getMeasuredHeightCacheKey(cacheKey, normalizedWidth, message.id),
    {
      height: normalizedHeight,
      signature: getMessageSignature(message),
    },
  );
}

function buildEstimatedChatMessageFrameLayout(
  messages: ChatMessage[],
  {
    cacheKey,
    containerWidth,
    isSessionActive,
  }: Pick<BuildChatMessageFrameLayoutOptions, 'cacheKey' | 'containerWidth' | 'isSessionActive'>,
): ChatMessageFrameLayout {
  const normalizedWidth = normalizeChatContainerWidth(containerWidth);
  const key = getFrameLayoutCacheKey(cacheKey, normalizedWidth, isSessionActive);
  const messageSignatures = getMessageSignatures(messages);
  const signature = messageSignatures.join('\u0001');
  const cached = estimatedFrameLayoutCache.get(key);
  if (cached && cached.signature === signature) {
    return cached.layout;
  }

  const sharedPrefixLength = cached
    ? getSharedMessagePrefixLength(cached.messageSignatures, messageSignatures)
    : 0;
  const items = sharedPrefixLength > 0
    ? cached!.layout.items.slice(0, sharedPrefixLength)
    : [];
  let offset = sharedPrefixLength > 0
    ? items[items.length - 1]!.bottom + (sharedPrefixLength < messages.length ? CHAT_MESSAGE_LIST_GAP : 0)
    : CHAT_MESSAGE_LIST_TOP_PADDING;

  for (let index = sharedPrefixLength; index < messages.length; index += 1) {
    const message = messages[index]!;
    const estimatedHeight = estimateChatMessageHeight(message, {
      containerWidth: normalizedWidth,
      isStreaming: isSessionActive && index === messages.length - 1,
    });
    const height = Math.max(1, Math.ceil(estimatedHeight));
    const top = offset;
    const bottom = top + height;

    items.push({
      bottom,
      height,
      id: message.id,
      index,
      top,
    });

    offset = bottom;
    if (index < messages.length - 1) {
      offset += CHAT_MESSAGE_LIST_GAP;
    }
  }

  const layout = {
    endOffset: offset,
    items,
  };
  setEstimatedFrameLayoutCacheEntry(key, { layout, messageSignatures, signature });
  return layout;
}

export function buildChatMessageFrameLayout(
  messages: ChatMessage[],
  {
    cacheKey,
    containerWidth,
    isSessionActive,
    measuredHeights,
  }: BuildChatMessageFrameLayoutOptions,
): ChatMessageFrameLayout {
  const estimatedLayout = buildEstimatedChatMessageFrameLayout(messages, {
    cacheKey,
    containerWidth,
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
    const measuredHeight = measuredHeights.get(frame.id);
    const height = measuredHeight === undefined
      ? frame.height
      : Math.max(1, Math.ceil(measuredHeight));

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
      offset += CHAT_MESSAGE_LIST_GAP;
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
