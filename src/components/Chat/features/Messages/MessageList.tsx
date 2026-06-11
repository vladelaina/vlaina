import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { MessageItem } from './components/MessageItem';
import { ChatLoading } from '@/components/Chat/features/Messages/components/ChatLoading';
import { OverlayScrollArea } from '@/components/ui/overlay-scroll-area';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/lib/ai/types';
import { parseErrorTag, stripFirstErrorTag } from '@/lib/ai/errorTag';
import { isManagedModelId } from '@/lib/ai/managedService';
import { stripThinkingContent } from '@/lib/ai/stripThinkingContent';
import { useAccountSessionStore } from '@/stores/accountSession';
import {
  buildChatMessageFrameLayout,
  buildTrailingChatLayout,
  rememberMeasuredChatMessageHeight,
  resolveChatMessageListOverscan,
  resolveVisibleChatMessageRange,
  restoreCachedMeasuredHeights,
} from '@/components/Chat/features/Layout/chatMessageFrames';
import { normalizeChatContainerWidth } from '@/components/Chat/features/Layout/chatWidthBuckets';
import { themeRenderingTokens } from '@/styles/themeTokens';

interface ChatImageGalleryItem {
  id: string;
  src: string;
}

type ChatImageGalleryGetter = () => ChatImageGalleryItem[];
const TAIL_ANCHOR_THRESHOLD = 2;
const STREAM_SCROLL_IDLE_MS = 180;
interface RenderedMessageRow {
  message: ChatMessage;
  originalIndex: number;
}

interface RenderedMessageState {
  ids: Set<string>;
  messageById: Map<string, ChatMessage>;
  messages: ChatMessage[];
  rows: RenderedMessageRow[];
}

function isPureManagedAuthErrorMessage(message: ChatMessage): boolean {
  const parsedError = parseErrorTag(message.content);
  if (parsedError?.type !== 'AUTH_ERROR' || !isManagedModelId(message.modelId)) {
    return false;
  }

  const contentWithoutError = stripFirstErrorTag(message.content);
  return stripThinkingContent(contentWithoutError).trim().length === 0;
}

function shouldHideManagedAuthMessage(message: ChatMessage, isLastMessage: boolean, isAccountConnected: boolean): boolean {
  if (!isPureManagedAuthErrorMessage(message)) {
    return false;
  }

  return isAccountConnected || !isLastMessage;
}

interface MessageListProps {
  active?: boolean;
  chatId?: string | null;
  messages: ChatMessage[];
  getImageGallery?: ChatImageGalleryGetter;
  isSessionActive: boolean;
  showLoading: boolean;
  isLayoutCentered?: boolean;
  useOverlayScrollbar?: boolean;
  spacerHeight: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onCopy: (text: string) => Promise<boolean | void> | boolean | void;
  onRegenerate: (id: string) => void;
  onEdit?: (id: string, newContent: string) => void;
  onSwitchVersion: (msgId: string, idx: number) => void;
}

function areMeasuredHeightsEqual(
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

export const MessageList = memo(function MessageList({
  active = true,
  chatId,
  messages,
  getImageGallery,
  isSessionActive,
  showLoading,
  isLayoutCentered,
  useOverlayScrollbar = false,
  spacerHeight,
  containerRef,
  onCopy,
  onRegenerate,
  onEdit,
  onSwitchVersion
}: MessageListProps) {
  const isAccountConnected = useAccountSessionStore((state) => state.isConnected);
  const renderedState = useMemo<RenderedMessageState>(() => {
    const rows: RenderedMessageRow[] = [];
    const renderedMessages: ChatMessage[] = [];
    const ids = new Set<string>();
    const messageById = new Map<string, ChatMessage>();

    for (let index = 0; index < messages.length; index += 1) {
      const message = messages[index]!;
      if (shouldHideManagedAuthMessage(message, index === messages.length - 1, isAccountConnected)) {
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
  }, [isAccountConnected, messages]);
  const renderedRows = renderedState.rows;
  const renderedMessages = renderedState.messages;
  const isEmpty = renderedMessages.length === 0;
  const [viewportHeight, setViewportHeight] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [isScrollActive, setIsScrollActive] = useState(false);
  const [isTailDetached, setIsTailDetached] = useState(false);
  const [measuredHeights, setMeasuredHeights] = useState<Map<string, number>>(new Map());
  const observedRowsRef = useRef(new Map<string, HTMLDivElement>());
  const visibleRowRefCallbacksRef = useRef(new Map<string, (node: HTMLDivElement | null) => void>());
  const rowResizeObserverRef = useRef<ResizeObserver | null>(null);
  const viewportMetricsRafRef = useRef<number | null>(null);
  const measuredHeightsRafRef = useRef<number | null>(null);
  const scrollIdleTimeoutRef = useRef<number | null>(null);
  const lastObservedScrollTopRef = useRef<number | null>(null);
  const isScrollActiveRef = useRef(isScrollActive);
  const isTailDetachedRef = useRef(isTailDetached);
  const pendingMeasuredHeightsRef = useRef(new Map<string, number>());
  const measuredHeightsRef = useRef(measuredHeights);
  const activeRef = useRef(active);
  const lastStreamingMessageIdRef = useRef<string | null>(null);
  const measuredHeightContextRef = useRef({
    activeMeasuredMessageId: null as string | null,
    chatId,
    isSessionActive,
    layoutWidth: 0,
    messageById: new Map<string, ChatMessage>(),
  });
  const layoutWidth = useMemo(
    () => (viewportWidth > 0 ? normalizeChatContainerWidth(viewportWidth) : 0),
    [viewportWidth]
  );
  const lastStreamingMessageId = isSessionActive
    ? renderedMessages[renderedMessages.length - 1]?.id ?? null
    : null;
  const activeMeasuredMessageId =
    isSessionActive && renderedMessages[renderedMessages.length - 1]?.role === 'assistant'
      ? renderedMessages[renderedMessages.length - 1]!.id
      : null;
  measuredHeightsRef.current = measuredHeights;
  activeRef.current = active;
  lastStreamingMessageIdRef.current = lastStreamingMessageId;
  isScrollActiveRef.current = isScrollActive;
  isTailDetachedRef.current = isTailDetached;
  const messageById = renderedState.messageById;

  useEffect(() => {
    measuredHeightContextRef.current = {
      activeMeasuredMessageId,
      chatId,
      isSessionActive,
      layoutWidth,
      messageById,
    };
  }, [activeMeasuredMessageId, chatId, isSessionActive, layoutWidth, messageById]);

  const commitViewportMetrics = useCallback(() => {
    if (!activeRef.current) {
      return;
    }

    const viewport = containerRef.current;
    if (!viewport) {
      return;
    }

    if (viewport.clientHeight <= 0 || viewport.clientWidth <= 0) {
      return;
    }

    setViewportHeight((current) => (
      current === viewport.clientHeight ? current : viewport.clientHeight
    ));
    setViewportWidth((current) => (
      current === viewport.clientWidth ? current : viewport.clientWidth
    ));
    setScrollTop((current) => (
      current === viewport.scrollTop ? current : viewport.scrollTop
    ));
  }, [containerRef]);

  const scheduleViewportMetrics = useCallback(() => {
    if (viewportMetricsRafRef.current !== null) {
      return;
    }

    viewportMetricsRafRef.current = requestAnimationFrame(() => {
      viewportMetricsRafRef.current = null;
      commitViewportMetrics();
    });
  }, [commitViewportMetrics]);

  useLayoutEffect(() => {
    if (!active) {
      return;
    }

    commitViewportMetrics();
    const frameId = requestAnimationFrame(() => {
      commitViewportMetrics();
    });

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [active, commitViewportMetrics, renderedMessages.length, isEmpty]);

  useEffect(() => {
    if (!active) {
      return;
    }

    const viewport = containerRef.current;
    if (!viewport) {
      return;
    }

    const handleScroll = (event: Event) => {
      const currentScrollTop = viewport.scrollTop;
      const previousScrollTop = lastObservedScrollTopRef.current;
      lastObservedScrollTopRef.current = currentScrollTop;
      scheduleViewportMetrics();
      if (event.type !== 'scroll' || !isSessionActive) {
        return;
      }

      const userScrolledUp =
        previousScrollTop !== null && currentScrollTop < previousScrollTop - 1;
      const distanceToBottom =
        viewport.scrollHeight - (currentScrollTop + viewport.clientHeight);
      if (userScrolledUp && !isTailDetachedRef.current) {
        isTailDetachedRef.current = true;
        setIsTailDetached(true);
      } else if (distanceToBottom <= TAIL_ANCHOR_THRESHOLD && isTailDetachedRef.current) {
        isTailDetachedRef.current = false;
        setIsTailDetached(false);
      }

      if (!isScrollActiveRef.current) {
        isScrollActiveRef.current = true;
        setIsScrollActive(true);
      }
      if (scrollIdleTimeoutRef.current !== null) {
        window.clearTimeout(scrollIdleTimeoutRef.current);
      }
      scrollIdleTimeoutRef.current = window.setTimeout(() => {
        scrollIdleTimeoutRef.current = null;
        isScrollActiveRef.current = false;
        setIsScrollActive(false);
      }, STREAM_SCROLL_IDLE_MS);
    };

    commitViewportMetrics();
    viewport.addEventListener('scroll', handleScroll, { passive: true });
    viewport.addEventListener('chat-programmatic-scroll', handleScroll);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        scheduleViewportMetrics();
      });
      resizeObserver.observe(viewport);
    }

    return () => {
      viewport.removeEventListener('scroll', handleScroll);
      viewport.removeEventListener('chat-programmatic-scroll', handleScroll);
      resizeObserver?.disconnect();
      if (viewportMetricsRafRef.current !== null) {
        cancelAnimationFrame(viewportMetricsRafRef.current);
        viewportMetricsRafRef.current = null;
      }
      if (scrollIdleTimeoutRef.current !== null) {
        window.clearTimeout(scrollIdleTimeoutRef.current);
        scrollIdleTimeoutRef.current = null;
      }
    };
  }, [active, commitViewportMetrics, containerRef, isSessionActive, scheduleViewportMetrics, useOverlayScrollbar]);

  useEffect(() => {
    if (isSessionActive) {
      return;
    }

    if (scrollIdleTimeoutRef.current !== null) {
      window.clearTimeout(scrollIdleTimeoutRef.current);
      scrollIdleTimeoutRef.current = null;
    }
    isScrollActiveRef.current = false;
    isTailDetachedRef.current = false;
    setIsScrollActive(false);
    setIsTailDetached(false);
  }, [isSessionActive]);

  useEffect(() => {
    if (layoutWidth <= 0) {
      setMeasuredHeights((current) => (current.size === 0 ? current : new Map()));
      return;
    }

    setMeasuredHeights((current) => {
      const restored = restoreCachedMeasuredHeights(renderedMessages, {
        activeMessageId: activeMeasuredMessageId,
        cacheKey: chatId,
        containerWidth: layoutWidth,
        isSessionActive,
      });
      return areMeasuredHeightsEqual(current, restored) ? current : restored;
    });
  }, [activeMeasuredMessageId, chatId, isSessionActive, layoutWidth, renderedMessages]);

  const flushMeasuredHeights = useCallback(() => {
    measuredHeightsRafRef.current = null;
    if (pendingMeasuredHeightsRef.current.size === 0) {
      return;
    }

    const pendingHeights = pendingMeasuredHeightsRef.current;
    pendingMeasuredHeightsRef.current = new Map();

    const {
      chatId: activeChatId,
      activeMeasuredMessageId,
      isSessionActive: activeIsSessionActive,
      layoutWidth: activeLayoutWidth,
      messageById: activeMessageById,
    } = measuredHeightContextRef.current;

    if (activeLayoutWidth > 0) {
      pendingHeights.forEach((height, messageId) => {
        const message = activeMessageById.get(messageId);
        if (!message) {
          return;
        }

        rememberMeasuredChatMessageHeight(message, {
          cacheKey: activeChatId,
          containerWidth: activeLayoutWidth,
          isSessionActive: activeIsSessionActive && message.id === activeMeasuredMessageId,
          height,
        });
      });
    }

    setMeasuredHeights((current) => {
      let next = current;
      let didChange = false;

      pendingHeights.forEach((height, messageId) => {
        if (!activeMessageById.has(messageId)) {
          return;
        }
        if (next.get(messageId) === height) {
          return;
        }

        if (!didChange) {
          next = new Map(current);
          didChange = true;
        }
        next.set(messageId, height);
      });

      return didChange ? next : current;
    });
  }, []);

  const scheduleMeasuredHeight = useCallback((messageId: string, nextHeight: number) => {
    if (!Number.isFinite(nextHeight) || nextHeight <= 0) {
      return;
    }

    const normalizedHeight = Math.max(1, Math.ceil(nextHeight));
    if (pendingMeasuredHeightsRef.current.get(messageId) === normalizedHeight) {
      return;
    }

    pendingMeasuredHeightsRef.current.set(messageId, normalizedHeight);
    if (measuredHeightsRafRef.current !== null) {
      return;
    }

    measuredHeightsRafRef.current = requestAnimationFrame(() => {
      flushMeasuredHeights();
    });
  }, [flushMeasuredHeights]);

  const shouldMeasureVisibleRowSynchronously = useCallback((messageId: string) => {
    if (messageId === lastStreamingMessageIdRef.current) {
      return true;
    }

    return !measuredHeightsRef.current.has(messageId);
  }, []);

  useEffect(() => {
    if (!active) {
      return;
    }

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      if (!activeRef.current) {
        return;
      }

      for (const entry of entries) {
        const element = entry.target as HTMLDivElement;
        const messageId = element.dataset.messageId;
        if (!messageId) {
          continue;
        }
        scheduleMeasuredHeight(messageId, entry.contentRect.height);
      }
    });

    rowResizeObserverRef.current = observer;
    observedRowsRef.current.forEach((node, messageId) => {
      node.dataset.messageId = messageId;
      observer.observe(node);
      if (shouldMeasureVisibleRowSynchronously(messageId)) {
        scheduleMeasuredHeight(messageId, node.getBoundingClientRect().height);
      }
    });

    return () => {
      rowResizeObserverRef.current = null;
      observer.disconnect();
      if (measuredHeightsRafRef.current !== null) {
        cancelAnimationFrame(measuredHeightsRafRef.current);
        measuredHeightsRafRef.current = null;
      }
      pendingMeasuredHeightsRef.current.clear();
    };
  }, [active, flushMeasuredHeights, scheduleMeasuredHeight, shouldMeasureVisibleRowSynchronously]);

  useLayoutEffect(() => {
    if (!active) {
      return;
    }

    if (!lastStreamingMessageId) {
      return;
    }

    const node = observedRowsRef.current.get(lastStreamingMessageId);
    if (!node) {
      return;
    }

    scheduleMeasuredHeight(lastStreamingMessageId, node.getBoundingClientRect().height);
  }, [active, lastStreamingMessageId, scheduleMeasuredHeight]);

  const bindVisibleRow = useCallback((messageId: string, node: HTMLDivElement | null) => {
    const previous = observedRowsRef.current.get(messageId);
    if (previous && rowResizeObserverRef.current) {
      rowResizeObserverRef.current.unobserve(previous);
    }

    if (!node) {
      observedRowsRef.current.delete(messageId);
      return;
    }

    node.dataset.messageId = messageId;
    observedRowsRef.current.set(messageId, node);
    rowResizeObserverRef.current?.observe(node);
    if (activeRef.current && shouldMeasureVisibleRowSynchronously(messageId)) {
      scheduleMeasuredHeight(messageId, node.getBoundingClientRect().height);
    }
  }, [scheduleMeasuredHeight, shouldMeasureVisibleRowSynchronously]);
  const bindVisibleRowRef = useRef(bindVisibleRow);

  useEffect(() => {
    bindVisibleRowRef.current = bindVisibleRow;
  }, [bindVisibleRow]);

  useEffect(() => {
    visibleRowRefCallbacksRef.current.forEach((_callback, messageId) => {
      if (!renderedState.ids.has(messageId)) {
        visibleRowRefCallbacksRef.current.delete(messageId);
      }
    });
  }, [renderedState]);

  const getVisibleRowRef = useCallback((messageId: string) => {
    const cached = visibleRowRefCallbacksRef.current.get(messageId);
    if (cached) {
      return cached;
    }

    const callback = (node: HTMLDivElement | null) => {
      bindVisibleRowRef.current(messageId, node);
    };
    visibleRowRefCallbacksRef.current.set(messageId, callback);
    return callback;
  }, []);

  const frameLayout = useMemo(
    () => buildChatMessageFrameLayout(renderedMessages, {
      activeMessageId: activeMeasuredMessageId,
      cacheKey: chatId,
      containerWidth: Math.max(layoutWidth, 1),
      isSessionActive,
      measuredHeights,
    }),
    [activeMeasuredMessageId, chatId, isSessionActive, layoutWidth, measuredHeights, renderedMessages]
  );

  const trailingLayout = useMemo(
    () => buildTrailingChatLayout(frameLayout, showLoading, spacerHeight),
    [frameLayout, showLoading, spacerHeight]
  );

  const visibleRange = useMemo(() => {
    const shouldAnchorTail =
      (isSessionActive || showLoading || spacerHeight > 0) &&
      !isScrollActive &&
      !isTailDetached &&
      trailingLayout.totalHeight - (scrollTop + viewportHeight) <= TAIL_ANCHOR_THRESHOLD;
    const overscan = resolveChatMessageListOverscan({
      anchorTail: shouldAnchorTail,
      isSessionActive: isSessionActive || showLoading,
      viewportHeight,
    });

    return resolveVisibleChatMessageRange(frameLayout.items, {
      anchorTail: shouldAnchorTail,
      overscan,
      scrollTop,
      viewportHeight,
    });
  }, [
    frameLayout.items,
    isSessionActive,
    isScrollActive,
    isTailDetached,
    scrollTop,
    showLoading,
    spacerHeight,
    trailingLayout.totalHeight,
    viewportHeight,
  ]);

  const visibleFrames = useMemo(
    () => frameLayout.items.slice(visibleRange.start, visibleRange.end),
    [frameLayout.items, visibleRange.end, visibleRange.start]
  );

  const content = (
    <div className="w-full max-w-[var(--vlaina-size-850px)] mx-auto px-4">
      {!isEmpty && (
        <div
          className="relative w-full min-h-full"
          style={{ height: trailingLayout.totalHeight }}
        >
          {visibleFrames.map((frame) => {
            const row = renderedRows[frame.index]!;
            const message = row.message;
            return (
              <div
                key={frame.id}
                data-message-index={row.originalIndex}
                className="absolute left-0 right-0"
                style={{ top: frame.top }}
                ref={getVisibleRowRef(frame.id)}
              >
                <MessageItem
                  msg={message}
                  userBubbleContainerWidth={layoutWidth}
                  getImageGallery={getImageGallery}
                  isLoading={isSessionActive && frame.index === renderedMessages.length - 1}
                  isLastMessage={frame.index === renderedMessages.length - 1}
                  suspendStreamAnimation={
                    isScrollActive &&
                    isSessionActive &&
                    frame.index === renderedMessages.length - 1
                  }
                  onCopy={onCopy}
                  onRegenerate={onRegenerate}
                  onEdit={onEdit}
                  onSwitchVersion={onSwitchVersion}
                />
              </div>
            );
          })}

          {showLoading && trailingLayout.loadingTop !== null && (
            <div
              className="absolute left-0 right-0"
              style={{ top: trailingLayout.loadingTop }}
            >
              <ChatLoading />
            </div>
          )}

          {spacerHeight > 0 && trailingLayout.spacerTop !== null && (
            <div
              aria-hidden="true"
              className="absolute left-0 right-0"
              style={{
                top: trailingLayout.spacerTop,
                height: spacerHeight,
              }}
            />
          )}
        </div>
      )}
    </div>
  );

  if (useOverlayScrollbar) {
    return (
      <OverlayScrollArea
        ref={containerRef}
        data-chat-scrollable="true"
        style={{ overflowAnchor: themeRenderingTokens.overflowAnchorNone }}
        className={cn(
          'transition-opacity duration-[var(--vlaina-duration-500)]',
          isEmpty ? 'pointer-events-none opacity-[var(--vlaina-opacity-0)]' : 'opacity-[var(--vlaina-opacity-100)]',
          isLayoutCentered && 'hidden',
        )}
        viewportClassName="h-full"
        scrollbarVariant="compact"
      >
        {content}
      </OverlayScrollArea>
    );
  }

  return (
      <div
        data-chat-scrollable="true"
        style={{ overflowAnchor: themeRenderingTokens.overflowAnchorNone }}
        className={cn(
          'flex-1 overflow-x-hidden overflow-y-auto transition-opacity duration-[var(--vlaina-duration-500)]',
          isEmpty ? 'pointer-events-none opacity-[var(--vlaina-opacity-0)]' : 'opacity-[var(--vlaina-opacity-100)]',
          isLayoutCentered && 'hidden',
        )}
        ref={containerRef}
      >
        {content}
      </div>
  );
});
