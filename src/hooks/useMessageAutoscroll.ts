import {
  useRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
  useMemo,
} from "react";
import type { ChatMessage } from "@/lib/ai/types";
import {
  buildChatMessageFrameLayout,
  CHAT_MESSAGE_LIST_GAP,
} from "@/components/Chat/features/Layout/chatMessageFrames";
import { normalizeChatContainerWidth } from "@/components/Chat/features/Layout/chatWidthBuckets";

interface UseMessageAutoscrollOptions {
  messages: ChatMessage[];
  isStreaming: boolean;
  chatId: string | null;
  estimateMessageHeight?: (message: ChatMessage, isStreaming: boolean, containerWidth: number) => number;
  estimateLoadingHeight?: () => number;
  showLoading?: boolean;
}

interface MessageAutoscrollBehavior {
  handleNewUserMessage: () => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
  spacerHeight: number;
}

const NEAR_BOTTOM_THRESHOLD = 96;
const MAX_BASE_SPACER_RATIO = 0.35;
const STREAMING_EXTRA_SPACER_RATIO = 0.18;

function isNearBottom(container: HTMLElement): boolean {
  const distanceToBottom =
    container.scrollHeight - (container.scrollTop + container.clientHeight);
  return distanceToBottom <= NEAR_BOTTOM_THRESHOLD;
}

function computeSpacerHeight(
  containerHeight: number,
  targetMessageHeight: number,
  contentHeightAfterTarget: number,
  hasVisibleAssistantOutput: boolean,
): number {
  const unclampedBaseHeight = Math.max(
    0,
    containerHeight - contentHeightAfterTarget - targetMessageHeight,
  );
  const maxBaseHeight = containerHeight * MAX_BASE_SPACER_RATIO;
  const baseHeight = Math.min(unclampedBaseHeight, maxBaseHeight);
  const extraSpaceForAssistant = hasVisibleAssistantOutput
    ? containerHeight * STREAMING_EXTRA_SPACER_RATIO
    : 0;

  return Math.max(0, Math.round(baseHeight + extraSpaceForAssistant));
}

export const useMessageAutoscroll = ({
  messages,
  isStreaming,
  chatId,
  estimateMessageHeight,
  estimateLoadingHeight,
  showLoading = false,
}: UseMessageAutoscrollOptions): MessageAutoscrollBehavior => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const updateSpacerHeightRef = useRef<() => void>(() => {});
  const isStreamingRef = useRef(isStreaming);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const observedContainerRef = useRef<HTMLDivElement | null>(null);
  const pendingScrollToBottomRef = useRef(false);
  const pendingScrollMessageCountRef = useRef<number | null>(null);
  const isAutoFollowRef = useRef(true);
  const prevChatIdRef = useRef<string | null>(chatId);
  const initialScrollPendingRef = useRef(!!chatId);
  const [spacerHeight, setSpacerHeight] = useState(0);
  const [shouldScrollToBottom, setShouldScrollToBottom] = useState(false);

  const getLastUserMessageIndex = useCallback(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].role === "user") {
        return i;
      }
    }
    return -1;
  }, [messages]);

  const hasVisibleAssistantOutput = useMemo(() => {
    const lastUserIndex = getLastUserMessageIndex();
    if (lastUserIndex < 0) {
      return false;
    }

    return messages
      .slice(lastUserIndex + 1)
      .some((m) => m.role === "assistant" && m.content.trim().length > 0);
  }, [getLastUserMessageIndex, messages]);

  const updateSpacerHeight = useCallback(() => {
    if (!containerRef.current) {
      return;
    }

    if (!isStreaming) {
      setSpacerHeight(0);
      return;
    }

    const container = containerRef.current;
    const containerHeight = container.clientHeight;
    const layoutWidth = normalizeChatContainerWidth(container.clientWidth);
    const lastUserIndex = getLastUserMessageIndex();

    if (lastUserIndex < 0) {
      setSpacerHeight(0);
      return;
    }

    let targetMessageHeight = 0;
    let contentHeightAfterTarget = 0;

    if (estimateMessageHeight) {
      targetMessageHeight = estimateMessageHeight(
        messages[lastUserIndex]!,
        false,
        layoutWidth,
      );
      contentHeightAfterTarget = messages
        .slice(lastUserIndex + 1)
        .reduce(
          (sum, message, index) =>
            sum +
            estimateMessageHeight(
              message,
              isStreaming && lastUserIndex + 1 + index === messages.length - 1,
              layoutWidth,
            ),
          0,
        );

      if (messages.length > lastUserIndex + 1) {
        contentHeightAfterTarget +=
          (messages.length - lastUserIndex - 1) * CHAT_MESSAGE_LIST_GAP;
      }
    } else {
      const estimatedLayout = buildChatMessageFrameLayout(messages, {
        cacheKey: chatId,
        containerWidth: layoutWidth,
        isSessionActive: isStreaming,
      });
      const targetFrame = estimatedLayout.items[lastUserIndex];
      if (!targetFrame) {
        setSpacerHeight(0);
        return;
      }

      targetMessageHeight = targetFrame.height;
      if (estimatedLayout.items.length > lastUserIndex + 1) {
        const lastFrame = estimatedLayout.items[estimatedLayout.items.length - 1]!;
        contentHeightAfterTarget = lastFrame.bottom - targetFrame.bottom;
      }
    }

    if (showLoading) {
      contentHeightAfterTarget += CHAT_MESSAGE_LIST_GAP + (estimateLoadingHeight?.() ?? 0);
    }

    const nextSpacerHeight = computeSpacerHeight(
      containerHeight,
      targetMessageHeight,
      contentHeightAfterTarget,
      isStreaming && hasVisibleAssistantOutput,
    );
    setSpacerHeight((current) => (current === nextSpacerHeight ? current : nextSpacerHeight));
  }, [
    chatId,
    estimateLoadingHeight,
    estimateMessageHeight,
    getLastUserMessageIndex,
    hasVisibleAssistantOutput,
    isStreaming,
    messages,
    showLoading,
  ]);

  useEffect(() => {
    updateSpacerHeightRef.current = updateSpacerHeight;
  }, [updateSpacerHeight]);

  useEffect(() => {
    isStreamingRef.current = isStreaming;
  }, [isStreaming]);

  const handleNewUserMessage = useCallback(() => {
    pendingScrollToBottomRef.current = true;
    pendingScrollMessageCountRef.current = messages.length;
    isAutoFollowRef.current = true;
    setSpacerHeight(0);
  }, [messages.length]);

  useLayoutEffect(() => {
    if (
      !pendingScrollToBottomRef.current ||
      pendingScrollMessageCountRef.current === null ||
      messages.length <= pendingScrollMessageCountRef.current ||
      !containerRef.current
    ) {
      return;
    }

    const container = containerRef.current;
    container.scrollTop = container.scrollHeight;
    pendingScrollToBottomRef.current = false;
    pendingScrollMessageCountRef.current = null;
    isAutoFollowRef.current = true;
  }, [messages]);

  useEffect(() => {
    if (prevChatIdRef.current !== chatId) {
      prevChatIdRef.current = chatId;
      pendingScrollToBottomRef.current = false;
      pendingScrollMessageCountRef.current = null;
      isAutoFollowRef.current = true;
      initialScrollPendingRef.current = !!chatId;
      setSpacerHeight(0);
      setShouldScrollToBottom(true);
    }
  }, [chatId]);

  useLayoutEffect(() => {
    if (
      !initialScrollPendingRef.current ||
      !chatId ||
      !messages.length ||
      !containerRef.current
    ) {
      return;
    }

    const container = containerRef.current;
    container.scrollTop = container.scrollHeight;
    isAutoFollowRef.current = true;
    initialScrollPendingRef.current = false;
  }, [chatId, messages.length]);

  useLayoutEffect(() => {
    if (!shouldScrollToBottom || !messages.length || !containerRef.current) {
      return;
    }

    const container = containerRef.current;
    container.scrollTop = container.scrollHeight;
    isAutoFollowRef.current = true;
    setShouldScrollToBottom(false);
  }, [messages, shouldScrollToBottom]);

  useLayoutEffect(() => {
    updateSpacerHeight();
  }, [messages, updateSpacerHeight]);

  useEffect(() => {
    updateSpacerHeight();
  }, [isStreaming]);

  useEffect(() => {
    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const container = containerRef.current;
    if (!container || observedContainerRef.current === container) {
      return;
    }

    resizeObserverRef.current?.disconnect();
    const resizeObserver = new ResizeObserver(() => {
      updateSpacerHeightRef.current();
    });

    resizeObserver.observe(container);
    resizeObserverRef.current = resizeObserver;
    observedContainerRef.current = container;
  }, [messages.length]);

  useLayoutEffect(() => {
    if (
      !isStreaming ||
      !hasVisibleAssistantOutput ||
      !isAutoFollowRef.current ||
      !containerRef.current
    ) {
      return;
    }

    const container = containerRef.current;
    const rafId = requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });

    return () => cancelAnimationFrame(rafId);
  }, [hasVisibleAssistantOutput, isStreaming, messages]);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const handleScroll = () => {
      if (isNearBottom(container)) {
        isAutoFollowRef.current = true;
        return;
      }

      if (isStreamingRef.current) {
        isAutoFollowRef.current = false;
      }
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, []);

  useEffect(() => {
    if (typeof ResizeObserver !== "undefined") {
      return;
    }

    const handleResize = () => {
      updateSpacerHeightRef.current();
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    return () => {
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      observedContainerRef.current = null;
      pendingScrollToBottomRef.current = false;
      pendingScrollMessageCountRef.current = null;
    };
  }, []);

  return useMemo(
    () => ({
      handleNewUserMessage,
      containerRef,
      spacerHeight,
    }),
    [handleNewUserMessage, spacerHeight],
  );
};
