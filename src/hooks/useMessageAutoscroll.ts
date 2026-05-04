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
  CHAT_MESSAGE_LOADING_GAP,
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
const STREAMING_EXTRA_SPACER_RATIO = 0.08;
const CURRENT_TURN_ANCHOR_MAX_ATTEMPTS = 8;
const ACTIVE_OUTPUT_OVERFLOW_THRESHOLD = 1;
const LONG_USER_MESSAGE_VISIBLE_HEIGHT = 96;

function hasUsableScrollContainer(container: HTMLElement | null): container is HTMLElement {
  return !!container && container.clientHeight > 0 && container.clientWidth > 0;
}

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
  targetVisibleHeight = targetMessageHeight,
): number {
  const unclampedBaseHeight = Math.max(
    0,
    containerHeight - contentHeightAfterTarget - targetVisibleHeight,
  );
  const extraSpaceForAssistant = hasVisibleAssistantOutput
    ? containerHeight * STREAMING_EXTRA_SPACER_RATIO
    : 0;

  return Math.max(0, Math.round(unclampedBaseHeight + extraSpaceForAssistant));
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
  const scrollActiveOutputIfNeededRef = useRef<() => void>(() => {});
  const isStreamingRef = useRef(isStreaming);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const contentResizeObserverRef = useRef<ResizeObserver | null>(null);
  const activeOutputFollowRafRef = useRef<number | null>(null);
  const observedContainerRef = useRef<HTMLDivElement | null>(null);
  const observedContentRef = useRef<Element | null>(null);
  const messagesRef = useRef(messages);
  const pendingScrollToCurrentTurnRef = useRef(false);
  const pendingScrollMessageCountRef = useRef<number | null>(null);
  const pendingChatCreationAnchorRef = useRef(false);
  const isCurrentTurnAnchoredRef = useRef(false);
  const userDetachedFromCurrentTurnRef = useRef(false);
  const isAutoFollowRef = useRef(true);
  const programmaticScrollTopRef = useRef<number | null>(null);
  const lastContainerHeightRef = useRef(0);
  const prevChatIdRef = useRef<string | null>(chatId);
  const initialScrollPendingRef = useRef(!!chatId);
  const [spacerHeight, setSpacerHeight] = useState(0);
  const spacerHeightRef = useRef(0);
  const [shouldScrollToBottom, setShouldScrollToBottom] = useState(false);

  const getLastUserMessageIndex = useCallback(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].role === "user") {
        return i;
      }
    }
    return -1;
  }, [messages]);

  const setProgrammaticScrollTop = useCallback((container: HTMLElement, nextScrollTop: number) => {
    if (container.clientHeight > 0) {
      lastContainerHeightRef.current = container.clientHeight;
    }
    container.scrollTop = nextScrollTop;
    programmaticScrollTopRef.current = container.scrollTop;
    container.dispatchEvent(new Event("chat-programmatic-scroll"));
    return container.scrollTop;
  }, []);

  const scrollCurrentTurnIntoView = useCallback((): 'estimated' | 'rendered' | false => {
    if (!containerRef.current) {
      return false;
    }

    const container = containerRef.current;
    const lastUserIndex = getLastUserMessageIndex();
    if (lastUserIndex < 0) {
      return false;
    }

    const row = container.querySelector<HTMLElement>(`[data-message-index="${lastUserIndex}"]`);
    if (row) {
      const containerRect = container.getBoundingClientRect();
      const rowRect = row.getBoundingClientRect();
      const nextScrollTop = rowRect.height > container.clientHeight
        ? container.scrollTop + rowRect.bottom - containerRect.top - LONG_USER_MESSAGE_VISIBLE_HEIGHT
        : container.scrollTop + rowRect.top - containerRect.top;
      const actualScrollTop = setProgrammaticScrollTop(container, nextScrollTop);
      return Math.abs(actualScrollTop - nextScrollTop) <= 1 ? 'rendered' : 'estimated';
    }

    const containerRect = container.getBoundingClientRect();
    const renderedRows = Array.from(
      container.querySelectorAll<HTMLElement>('[data-message-index]'),
    );
    let previousRenderedRow: HTMLElement | null = null;
    let previousRenderedIndex = -1;

    for (const renderedRow of renderedRows) {
      const renderedIndex = Number(renderedRow.dataset.messageIndex);
      if (
        Number.isInteger(renderedIndex) &&
        renderedIndex < lastUserIndex &&
        renderedIndex > previousRenderedIndex
      ) {
        previousRenderedIndex = renderedIndex;
        previousRenderedRow = renderedRow;
      }
    }

    if (previousRenderedRow) {
      const previousRect = previousRenderedRow.getBoundingClientRect();
      const previousBottom = previousRect.bottom - containerRect.top + container.scrollTop;
      const requestedScrollTop = previousBottom + CHAT_MESSAGE_LIST_GAP;
      setProgrammaticScrollTop(container, requestedScrollTop);
      return 'estimated';
    }

    const layoutWidth = normalizeChatContainerWidth(container.clientWidth);
    const estimatedLayout = buildChatMessageFrameLayout(messages, {
      cacheKey: chatId,
      containerWidth: layoutWidth,
      isSessionActive: isStreamingRef.current,
    });
    const targetFrame = estimatedLayout.items[lastUserIndex];
    if (!targetFrame) {
      return false;
    }

    const nextScrollTop = targetFrame.height > container.clientHeight
      ? targetFrame.bottom - LONG_USER_MESSAGE_VISIBLE_HEIGHT
      : targetFrame.top;
    setProgrammaticScrollTop(container, nextScrollTop);
    return 'estimated';
  }, [chatId, getLastUserMessageIndex, messages, setProgrammaticScrollTop]);

  const scrollActiveOutputIfNeeded = useCallback(() => {
    if (!isAutoFollowRef.current || !containerRef.current) {
      return;
    }

    const container = containerRef.current;
    if (!hasUsableScrollContainer(container)) {
      return;
    }

    if (activeOutputFollowRafRef.current !== null) {
      return;
    }

    activeOutputFollowRafRef.current = 0;
    const activeOutputFollowRafId = requestAnimationFrame(() => {
      activeOutputFollowRafRef.current = null;
      if (!hasUsableScrollContainer(container)) {
        return;
      }

      if (!isStreamingRef.current || !isAutoFollowRef.current) {
        return;
      }

      if (isCurrentTurnAnchoredRef.current) {
        const activeMessages = messagesRef.current;
        const lastMessageIndex = activeMessages.length - 1;
        const row = container.querySelector<HTMLElement>(`[data-message-index="${lastMessageIndex}"]`);
        if (!row) {
          return;
        }

        const containerRect = container.getBoundingClientRect();
        const rowRect = row.getBoundingClientRect();
        const overflow = rowRect.bottom - containerRect.bottom;
        if (overflow > ACTIVE_OUTPUT_OVERFLOW_THRESHOLD) {
          setProgrammaticScrollTop(container, container.scrollTop + overflow);
        }
        return;
      }

      setProgrammaticScrollTop(container, container.scrollHeight);
    });
    if (activeOutputFollowRafRef.current === 0) {
      activeOutputFollowRafRef.current = activeOutputFollowRafId;
    }
  }, [setProgrammaticScrollTop]);

  useEffect(() => {
    scrollActiveOutputIfNeededRef.current = scrollActiveOutputIfNeeded;
  }, [scrollActiveOutputIfNeeded]);

  const restoreShortCompletedTurnAnchor = useCallback(() => {
    const container = containerRef.current;
    if (!container || !isCurrentTurnAnchoredRef.current) {
      return;
    }

    if (userDetachedFromCurrentTurnRef.current) {
      return;
    }

    const lastUserIndex = getLastUserMessageIndex();
    const userRow = lastUserIndex >= 0
      ? container.querySelector<HTMLElement>(`[data-message-index="${lastUserIndex}"]`)
      : null;
    const lastRow = messages.length > 0
      ? container.querySelector<HTMLElement>(`[data-message-index="${messages.length - 1}"]`)
      : null;

    if (!userRow || !lastRow) {
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const userRect = userRow.getBoundingClientRect();
    const lastRect = lastRow.getBoundingClientRect();
    const userTopOffset = userRect.top - containerRect.top;
    const userBottomOffset = userRect.bottom - containerRect.top;
    const outputBottomOffset = lastRect.bottom - containerRect.top;
    const outputFitsInViewport = outputBottomOffset <= container.clientHeight + 1;
    const isLongUserMessage = userRect.height > container.clientHeight;
    const restoreOffset = isLongUserMessage
      ? userBottomOffset - LONG_USER_MESSAGE_VISIBLE_HEIGHT
      : userTopOffset;
    if (Math.abs(restoreOffset) > 1 && outputFitsInViewport) {
      setProgrammaticScrollTop(container, container.scrollTop + restoreOffset);
    }
  }, [getLastUserMessageIndex, messages.length, setProgrammaticScrollTop]);

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

    const container = containerRef.current;
    const containerHeight = container.clientHeight;
    if (containerHeight <= 0 || container.clientWidth <= 0) {
      return;
    }
    lastContainerHeightRef.current = containerHeight;

    const layoutWidth = normalizeChatContainerWidth(container.clientWidth);
    const lastUserIndex = getLastUserMessageIndex();

    if (lastUserIndex < 0) {
      setSpacerHeight(0);
      return;
    }

    if (!isStreaming && !isCurrentTurnAnchoredRef.current) {
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

    if (showLoading && isStreaming) {
      contentHeightAfterTarget += CHAT_MESSAGE_LOADING_GAP + (estimateLoadingHeight?.() ?? 0);
    }

    const isLongUserMessage = targetMessageHeight > containerHeight;
    const targetVisibleHeight = isCurrentTurnAnchoredRef.current && isLongUserMessage
      ? LONG_USER_MESSAGE_VISIBLE_HEIGHT
      : targetMessageHeight;
    const nextSpacerHeight = computeSpacerHeight(
      containerHeight,
      targetMessageHeight,
      contentHeightAfterTarget,
      isStreaming && hasVisibleAssistantOutput,
      targetVisibleHeight,
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

  useLayoutEffect(() => {
    spacerHeightRef.current = spacerHeight;
  }, [spacerHeight]);

  useLayoutEffect(() => {
    if (prevChatIdRef.current === chatId) {
      return;
    }

    const shouldPreserveCurrentTurnAnchor =
      pendingScrollToCurrentTurnRef.current || pendingChatCreationAnchorRef.current;
    prevChatIdRef.current = chatId;
    isAutoFollowRef.current = true;

    if (shouldPreserveCurrentTurnAnchor) {
      pendingChatCreationAnchorRef.current = false;
      initialScrollPendingRef.current = false;
      setShouldScrollToBottom(false);
      return;
    }

    pendingChatCreationAnchorRef.current = false;
    pendingScrollToCurrentTurnRef.current = false;
    pendingScrollMessageCountRef.current = null;
    isCurrentTurnAnchoredRef.current = false;
    userDetachedFromCurrentTurnRef.current = false;
    initialScrollPendingRef.current = !!chatId;
    setSpacerHeight(0);
    setShouldScrollToBottom(!!chatId);
  }, [chatId]);

  useLayoutEffect(() => {
    const previous = isStreamingRef.current;
    isStreamingRef.current = isStreaming;
    if (previous && !isStreaming && isCurrentTurnAnchoredRef.current) {
      updateSpacerHeightRef.current();
      restoreShortCompletedTurnAnchor();

      let secondFrameId: number | null = null;
      const firstFrameId = requestAnimationFrame(() => {
        updateSpacerHeightRef.current();
        restoreShortCompletedTurnAnchor();
        secondFrameId = requestAnimationFrame(() => {
          updateSpacerHeightRef.current();
          restoreShortCompletedTurnAnchor();
        });
      });

      return () => {
        cancelAnimationFrame(firstFrameId);
        if (secondFrameId !== null) {
          cancelAnimationFrame(secondFrameId);
        }
      };
    }
  }, [isStreaming, restoreShortCompletedTurnAnchor]);

  useLayoutEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const handleNewUserMessage = useCallback(() => {
    pendingScrollToCurrentTurnRef.current = true;
    pendingScrollMessageCountRef.current = messages.length;
    pendingChatCreationAnchorRef.current = chatId === null;
    isCurrentTurnAnchoredRef.current = true;
    userDetachedFromCurrentTurnRef.current = false;
    isAutoFollowRef.current = true;
  }, [chatId, messages.length]);

  useLayoutEffect(() => {
    if (
      !pendingScrollToCurrentTurnRef.current ||
      pendingScrollMessageCountRef.current === null ||
      messages.length <= pendingScrollMessageCountRef.current ||
      !containerRef.current
    ) {
      return;
    }

    updateSpacerHeight();
    const initialAnchorResult = scrollCurrentTurnIntoView();
    if (initialAnchorResult === 'rendered') {
      pendingScrollToCurrentTurnRef.current = false;
      pendingScrollMessageCountRef.current = null;
      isAutoFollowRef.current = true;
      return;
    }

    let frameId = 0;
    let attempts = 0;
    const retryUntilRendered = () => {
      frameId = requestAnimationFrame(() => {
        attempts += 1;
        const result = scrollCurrentTurnIntoView();
        if (result === 'rendered' || attempts >= CURRENT_TURN_ANCHOR_MAX_ATTEMPTS) {
          pendingScrollToCurrentTurnRef.current = false;
          pendingScrollMessageCountRef.current = null;
          return;
        }
        retryUntilRendered();
      });
    };
    retryUntilRendered();
    isAutoFollowRef.current = true;
    return () => {
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [messages, scrollCurrentTurnIntoView, updateSpacerHeight]);

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
    setProgrammaticScrollTop(container, container.scrollHeight);
    isAutoFollowRef.current = true;
    initialScrollPendingRef.current = false;
  }, [chatId, messages.length, setProgrammaticScrollTop]);

  useLayoutEffect(() => {
    if (!shouldScrollToBottom || !messages.length || !containerRef.current) {
      return;
    }

    const container = containerRef.current;
    setProgrammaticScrollTop(container, container.scrollHeight);
    isAutoFollowRef.current = true;
    setShouldScrollToBottom(false);
  }, [messages, setProgrammaticScrollTop, shouldScrollToBottom]);

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

  useEffect(() => {
    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const container = containerRef.current;
    const content = container?.firstElementChild;
    if (!container || !content || observedContentRef.current === content) {
      return;
    }

    contentResizeObserverRef.current?.disconnect();
    const resizeObserver = new ResizeObserver(() => {
      updateSpacerHeightRef.current();
      if (isStreamingRef.current) {
        scrollActiveOutputIfNeededRef.current();
      }
    });

    resizeObserver.observe(content);
    contentResizeObserverRef.current = resizeObserver;
    observedContentRef.current = content;
  }, [messages.length, spacerHeight]);

  useLayoutEffect(() => {
    if (
      !isStreaming ||
      !hasVisibleAssistantOutput ||
      !isAutoFollowRef.current ||
      !containerRef.current
    ) {
      return;
    }

    const rafId = requestAnimationFrame(() => {
      scrollActiveOutputIfNeeded();
    });

    return () => cancelAnimationFrame(rafId);
  }, [hasVisibleAssistantOutput, isStreaming, messages, scrollActiveOutputIfNeeded]);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    if (container.clientHeight > 0) {
      lastContainerHeightRef.current = container.clientHeight;
    }
    const handleScroll = () => {
      if (
        programmaticScrollTopRef.current !== null &&
        Math.abs(container.scrollTop - programmaticScrollTopRef.current) <= 1
      ) {
        programmaticScrollTopRef.current = null;
        return;
      }

      if (isCurrentTurnAnchoredRef.current) {
        const activeMessages = messagesRef.current;
        let lastUserIndex = -1;
        for (let i = activeMessages.length - 1; i >= 0; i -= 1) {
          if (activeMessages[i]?.role === "user") {
            lastUserIndex = i;
            break;
          }
        }

        const userRow = lastUserIndex >= 0
          ? container.querySelector<HTMLElement>(`[data-message-index="${lastUserIndex}"]`)
          : null;
        const lastRow = activeMessages.length > 0
          ? container.querySelector<HTMLElement>(`[data-message-index="${activeMessages.length - 1}"]`)
          : null;

        if (userRow && lastRow) {
          const containerRect = container.getBoundingClientRect();
          const userRect = userRow.getBoundingClientRect();
          const lastRect = lastRow.getBoundingClientRect();
          const isLongUserMessage = userRect.height > container.clientHeight;
          const currentUserTopOffset = userRect.top - containerRect.top;
          const currentUserBottomOffset = userRect.bottom - containerRect.top;
          const outputBottomOffset = lastRect.bottom - containerRect.top;
          const currentUserTop = currentUserTopOffset + container.scrollTop;
          const currentUserBottom = currentUserBottomOffset + container.scrollTop;
          const userTailScrollTop = currentUserBottom - LONG_USER_MESSAGE_VISIBLE_HEIGHT;
          const currentUserAnchor = isLongUserMessage ? userTailScrollTop : currentUserTop;
          const outputBottom = outputBottomOffset + container.scrollTop;
          const outputBottomScrollTop = outputBottom - container.clientHeight;
          if (
            isLongUserMessage &&
            Math.abs(currentUserBottomOffset - LONG_USER_MESSAGE_VISIBLE_HEIGHT) <= 1 &&
            outputBottomOffset <= container.clientHeight + 1
          ) {
            return;
          }

          const maxUsefulScrollTop = Math.max(
            currentUserAnchor,
            outputBottomScrollTop,
          );

          if (container.scrollTop > maxUsefulScrollTop + 1) {
            setProgrammaticScrollTop(container, maxUsefulScrollTop);
            return;
          }
        }
      }

      if (isNearBottom(container)) {
        isAutoFollowRef.current = true;
        userDetachedFromCurrentTurnRef.current = false;
        return;
      }

      if (isStreamingRef.current) {
        if (isCurrentTurnAnchoredRef.current) {
          userDetachedFromCurrentTurnRef.current = true;
        }
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
      contentResizeObserverRef.current?.disconnect();
      contentResizeObserverRef.current = null;
      if (activeOutputFollowRafRef.current !== null && activeOutputFollowRafRef.current !== 0) {
        cancelAnimationFrame(activeOutputFollowRafRef.current);
      }
      activeOutputFollowRafRef.current = null;
      observedContainerRef.current = null;
      observedContentRef.current = null;
      pendingScrollToCurrentTurnRef.current = false;
      pendingScrollMessageCountRef.current = null;
      pendingChatCreationAnchorRef.current = false;
      isCurrentTurnAnchoredRef.current = false;
      userDetachedFromCurrentTurnRef.current = false;
      messagesRef.current = [];
    };
  }, []);

  const completionTransitionSpacerReserve =
    isStreamingRef.current &&
    !isStreaming &&
    isCurrentTurnAnchoredRef.current &&
    !userDetachedFromCurrentTurnRef.current
      ? lastContainerHeightRef.current
      : 0;
  const renderedSpacerHeight = spacerHeight + completionTransitionSpacerReserve;

  return useMemo(
    () => ({
      handleNewUserMessage,
      containerRef,
      spacerHeight: renderedSpacerHeight,
    }),
    [handleNewUserMessage, renderedSpacerHeight],
  );
};
