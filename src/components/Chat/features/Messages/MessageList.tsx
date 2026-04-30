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
import {
  buildChatMessageFrameLayout,
  buildTrailingChatLayout,
  rememberMeasuredChatMessageHeight,
  resolveChatMessageListOverscan,
  resolveVisibleChatMessageRange,
  restoreCachedMeasuredHeights,
} from '@/components/Chat/features/Layout/chatMessageFrames';
import { normalizeChatContainerWidth } from '@/components/Chat/features/Layout/chatWidthBuckets';

interface ChatImageGalleryItem {
  id: string;
  src: string;
}

type ChatImageGalleryGetter = () => ChatImageGalleryItem[];
const TAIL_ANCHOR_THRESHOLD = 128;

interface MessageListProps {
  chatId?: string | null;
  messages: ChatMessage[];
  getImageGallery?: ChatImageGalleryGetter;
  isSessionActive: boolean;
  showLoading: boolean;
  isLayoutCentered?: boolean;
  useOverlayScrollbar?: boolean;
  spacerHeight: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onCopy: (text: string) => Promise<void> | void;
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
  const isEmpty = messages.length === 0;
  const [viewportHeight, setViewportHeight] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [measuredHeights, setMeasuredHeights] = useState<Map<string, number>>(new Map());
  const observedRowsRef = useRef(new Map<string, HTMLDivElement>());
  const visibleRowRefCallbacksRef = useRef(new Map<string, (node: HTMLDivElement | null) => void>());
  const rowResizeObserverRef = useRef<ResizeObserver | null>(null);
  const viewportMetricsRafRef = useRef<number | null>(null);
  const measuredHeightsRafRef = useRef<number | null>(null);
  const pendingMeasuredHeightsRef = useRef(new Map<string, number>());
  const measuredHeightsRef = useRef(measuredHeights);
  const lastStreamingMessageIdRef = useRef<string | null>(null);
  const measuredHeightContextRef = useRef({
    chatId,
    layoutWidth: 0,
    messageById: new Map<string, ChatMessage>(),
  });
  const layoutWidth = useMemo(
    () => (viewportWidth > 0 ? normalizeChatContainerWidth(viewportWidth) : 0),
    [viewportWidth]
  );
  const lastStreamingMessageId = isSessionActive
    ? messages[messages.length - 1]?.id ?? null
    : null;
  measuredHeightsRef.current = measuredHeights;
  lastStreamingMessageIdRef.current = lastStreamingMessageId;
  const messageById = useMemo(
    () => new Map(messages.map((message) => [message.id, message])),
    [messages]
  );

  useEffect(() => {
    measuredHeightContextRef.current = {
      chatId,
      layoutWidth,
      messageById,
    };
  }, [chatId, layoutWidth, messageById]);

  const commitViewportMetrics = useCallback(() => {
    const viewport = containerRef.current;
    if (!viewport) {
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
    commitViewportMetrics();
  }, [commitViewportMetrics, messages.length, isEmpty]);

  useEffect(() => {
    const viewport = containerRef.current;
    if (!viewport) {
      return;
    }

    const handleScroll = () => {
      scheduleViewportMetrics();
    };

    commitViewportMetrics();
    viewport.addEventListener('scroll', handleScroll, { passive: true });

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        scheduleViewportMetrics();
      });
      resizeObserver.observe(viewport);
    }

    return () => {
      viewport.removeEventListener('scroll', handleScroll);
      resizeObserver?.disconnect();
      if (viewportMetricsRafRef.current !== null) {
        cancelAnimationFrame(viewportMetricsRafRef.current);
        viewportMetricsRafRef.current = null;
      }
    };
  }, [commitViewportMetrics, containerRef, scheduleViewportMetrics, useOverlayScrollbar]);

  useEffect(() => {
    if (layoutWidth <= 0) {
      setMeasuredHeights((current) => (current.size === 0 ? current : new Map()));
      return;
    }

    setMeasuredHeights((current) => {
      const restored = restoreCachedMeasuredHeights(messages, {
        cacheKey: chatId,
        containerWidth: layoutWidth,
      });
      return areMeasuredHeightsEqual(current, restored) ? current : restored;
    });
  }, [chatId, layoutWidth, messages]);

  const flushMeasuredHeights = useCallback(() => {
    measuredHeightsRafRef.current = null;
    if (pendingMeasuredHeightsRef.current.size === 0) {
      return;
    }

    const pendingHeights = pendingMeasuredHeightsRef.current;
    pendingMeasuredHeightsRef.current = new Map();

    const {
      chatId: activeChatId,
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
    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver((entries) => {
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
  }, [flushMeasuredHeights, scheduleMeasuredHeight, shouldMeasureVisibleRowSynchronously]);

  useLayoutEffect(() => {
    if (!lastStreamingMessageId) {
      return;
    }

    const node = observedRowsRef.current.get(lastStreamingMessageId);
    if (!node) {
      return;
    }

    scheduleMeasuredHeight(lastStreamingMessageId, node.getBoundingClientRect().height);
  }, [lastStreamingMessageId, scheduleMeasuredHeight]);

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
    if (shouldMeasureVisibleRowSynchronously(messageId)) {
      scheduleMeasuredHeight(messageId, node.getBoundingClientRect().height);
    }
  }, [scheduleMeasuredHeight, shouldMeasureVisibleRowSynchronously]);
  const bindVisibleRowRef = useRef(bindVisibleRow);

  useEffect(() => {
    bindVisibleRowRef.current = bindVisibleRow;
  }, [bindVisibleRow]);

  useEffect(() => {
    const activeMessageIds = new Set(messages.map((message) => message.id));
    visibleRowRefCallbacksRef.current.forEach((_callback, messageId) => {
      if (!activeMessageIds.has(messageId)) {
        visibleRowRefCallbacksRef.current.delete(messageId);
      }
    });
  }, [messages]);

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
    () => buildChatMessageFrameLayout(messages, {
      cacheKey: chatId,
      containerWidth: Math.max(layoutWidth, 1),
      isSessionActive,
      measuredHeights,
    }),
    [chatId, isSessionActive, layoutWidth, measuredHeights, messages]
  );

  const trailingLayout = useMemo(
    () => buildTrailingChatLayout(frameLayout, showLoading, spacerHeight),
    [frameLayout, showLoading, spacerHeight]
  );

  const visibleRange = useMemo(() => {
    const shouldAnchorTail =
      (isSessionActive || showLoading || spacerHeight > 0) &&
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
    <div className="w-full max-w-[850px] mx-auto px-4">
      {!isEmpty && (
        <div
          className="relative w-full min-h-full"
          style={{ height: trailingLayout.totalHeight }}
        >
          {visibleFrames.map((frame) => {
            const message = messages[frame.index]!;
            return (
              <div
                key={frame.id}
                data-message-index={frame.index}
                className="absolute left-0 right-0"
                style={{ top: frame.top }}
                ref={getVisibleRowRef(frame.id)}
              >
                <MessageItem
                  msg={message}
                  userBubbleContainerWidth={layoutWidth}
                  getImageGallery={getImageGallery}
                  isLoading={isSessionActive && frame.index === messages.length - 1}
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
        className={cn(
          'transition-opacity duration-500',
          isEmpty ? 'pointer-events-none opacity-0' : 'opacity-100',
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
        className={cn(
          'flex-1 overflow-y-auto transition-opacity duration-500',
          isEmpty ? 'pointer-events-none opacity-0' : 'opacity-100',
          isLayoutCentered && 'hidden',
        )}
        ref={containerRef}
      >
        {content}
      </div>
  );
});
