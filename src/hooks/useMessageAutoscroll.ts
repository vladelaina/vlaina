import {
  useRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
  useMemo,
} from "react";
import type { ChatMessage } from "@/lib/ai/types";

interface UseMessageAutoscrollOptions {
  messages: ChatMessage[];
  isStreaming: boolean;
  chatId: string | null;
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

export const useMessageAutoscroll = ({
  messages,
  isStreaming,
  chatId,
}: UseMessageAutoscrollOptions): MessageAutoscrollBehavior => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pendingScrollToUserMessage = useRef(false);
  const isTopAnchorModeRef = useRef(false);
  const isAutoFollowRef = useRef(true);
  const userScrollIntentRef = useRef(false);
  const userScrollIntentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevChatIdRef = useRef<string | null>(chatId);
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

  const scrollToMessage = useCallback(
    (messageIndex: number, behavior: ScrollBehavior = "smooth") => {
      if (!containerRef.current || messageIndex < 0) {
        return;
      }

      const container = containerRef.current;
      const targetElement = container.querySelector(
        `[data-message-index="${messageIndex}"]`,
      ) as HTMLElement | null;

      if (!targetElement) return;

      const containerStyle = window.getComputedStyle(container);
      const paddingTop = parseFloat(containerStyle.paddingTop) || 0;
      const containerRect = container.getBoundingClientRect();
      const targetRect = targetElement.getBoundingClientRect();
      const absoluteTargetTop =
        container.scrollTop + (targetRect.top - containerRect.top);
      const scrollHeight = container.scrollHeight;
      const containerHeight = container.clientHeight;
      const targetPosition = absoluteTargetTop - paddingTop;

      const maxScroll = scrollHeight - containerHeight;
      const finalPosition = Math.min(Math.max(0, targetPosition), maxScroll);

      container.scrollTo({
        top: finalPosition,
        behavior,
      });
    },
    [],
  );

  const updateSpacerHeight = useCallback(() => {
    if (!containerRef.current) {
      return;
    }

    const isInteractionActive =
      isStreaming ||
      pendingScrollToUserMessage.current ||
      isTopAnchorModeRef.current;
    if (!isInteractionActive) {
      setSpacerHeight(0);
      return;
    }

    const container = containerRef.current;
    const containerHeight = container.clientHeight;
    const lastUserIndex = getLastUserMessageIndex();

    if (lastUserIndex < 0) {
      setSpacerHeight(0);
      return;
    }

    const targetElement = container.querySelector(
      `[data-message-index="${lastUserIndex}"]`,
    ) as HTMLElement | null;

    if (!targetElement) {
      setSpacerHeight(0);
      return;
    }

    const messageElements = container.querySelectorAll(
      "[data-message-index]",
    ) as NodeListOf<HTMLElement>;

    const elementsAfter = Array.from(messageElements).filter((el) => {
      const idx = Number(el.dataset.messageIndex);
      return Number.isFinite(idx) && idx > lastUserIndex;
    });

    const contentHeightAfterTarget = elementsAfter.reduce(
      (sum, el) => sum + el.offsetHeight,
      0,
    );

    const targetMessageHeight = targetElement.offsetHeight;
    const unclampedBaseHeight = Math.max(
      0,
      containerHeight - contentHeightAfterTarget - targetMessageHeight,
    );
    const shouldForceTopAnchor =
      pendingScrollToUserMessage.current || isTopAnchorModeRef.current;
    const maxBaseHeight = containerHeight * MAX_BASE_SPACER_RATIO;
    const baseHeight = shouldForceTopAnchor
      ? unclampedBaseHeight
      : Math.min(unclampedBaseHeight, maxBaseHeight);

    const extraSpaceForAssistant =
      (isStreaming || isTopAnchorModeRef.current) && hasVisibleAssistantOutput
        ? containerHeight * STREAMING_EXTRA_SPACER_RATIO
        : 0;

    setSpacerHeight(Math.max(0, Math.round(baseHeight + extraSpaceForAssistant)));
  }, [getLastUserMessageIndex, hasVisibleAssistantOutput, isStreaming]);

  const handleNewUserMessage = useCallback(() => {
    pendingScrollToUserMessage.current = true;
    isTopAnchorModeRef.current = true;
    isAutoFollowRef.current = true;
  }, []);

  useLayoutEffect(() => {
    if (!pendingScrollToUserMessage.current) {
      return;
    }

    const targetUserIndex = getLastUserMessageIndex();
    if (targetUserIndex < 0) {
      pendingScrollToUserMessage.current = false;
      return;
    }

    let rafId = 0;
    let nestedRafId = 0;
    rafId = requestAnimationFrame(() => {
      updateSpacerHeight();
      nestedRafId = requestAnimationFrame(() => {
        scrollToMessage(targetUserIndex);
        pendingScrollToUserMessage.current = false;
      });
    });

    return () => {
      cancelAnimationFrame(rafId);
      if (nestedRafId) {
        cancelAnimationFrame(nestedRafId);
      }
    };
  }, [getLastUserMessageIndex, messages, scrollToMessage, updateSpacerHeight]);

  useEffect(() => {
    if (prevChatIdRef.current !== chatId) {
      prevChatIdRef.current = chatId;
      pendingScrollToUserMessage.current = false;
      isTopAnchorModeRef.current = false;
      isAutoFollowRef.current = true;
      setSpacerHeight(0);
      setShouldScrollToBottom(true);
    }
  }, [chatId]);

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
  }, [isStreaming, updateSpacerHeight]);

  useEffect(() => {
    if (!containerRef.current) return;

    let resizeTimeout: ReturnType<typeof setTimeout> | undefined;
    let immediateUpdate = false;
    const container = containerRef.current;

    const resizeObserver = new ResizeObserver((entries) => {
      let hasSignificantChange = false;
      for (const entry of entries) {
        const element = entry.target as HTMLElement;
        if (!element.dataset.messageIndex) continue;

        const heightDiff = Math.abs(entry.contentRect.height - element.offsetHeight);
        if (heightDiff > 50) {
          hasSignificantChange = true;
          break;
        }
      }

      if (hasSignificantChange || immediateUpdate) {
        updateSpacerHeight();
        immediateUpdate = false;
        return;
      }

      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }
      resizeTimeout = setTimeout(() => {
        updateSpacerHeight();
      }, 100);
    });

    const mutationObserver = new MutationObserver((mutations) => {
      const hasToggleMutation = mutations.some(
        (mutation) =>
          mutation.type === "attributes" &&
          (mutation.attributeName === "open" ||
            mutation.attributeName === "data-expanded"),
      );

      if (!hasToggleMutation) return;
      immediateUpdate = true;
      updateSpacerHeight();
    });

    resizeObserver.observe(container);
    mutationObserver.observe(container, {
      attributes: true,
      subtree: true,
      attributeFilter: ["open", "data-expanded"],
    });

    const messageElements = container.querySelectorAll(
      "[data-message-index]",
    ) as NodeListOf<HTMLElement>;
    messageElements.forEach((element) => resizeObserver.observe(element));

    return () => {
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [messages, updateSpacerHeight]);

  useLayoutEffect(() => {
    if (
      !isStreaming ||
      !hasVisibleAssistantOutput ||
      isTopAnchorModeRef.current ||
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
    const markUserScrollIntent = () => {
      userScrollIntentRef.current = true;
      if (userScrollIntentTimerRef.current) {
        clearTimeout(userScrollIntentTimerRef.current);
      }
      userScrollIntentTimerRef.current = setTimeout(() => {
        userScrollIntentRef.current = false;
        userScrollIntentTimerRef.current = null;
      }, 800);
    };

    const markKeyboardScrollIntent = (event: KeyboardEvent) => {
      const scrollKeys = new Set([
        "ArrowDown",
        "ArrowUp",
        "PageDown",
        "PageUp",
        "End",
        "Home",
        " ",
      ]);
      if (!scrollKeys.has(event.key)) return;
      markUserScrollIntent();
    };

    const handleScroll = () => {
      if (isNearBottom(container)) {
        if (isTopAnchorModeRef.current && userScrollIntentRef.current) {
          isTopAnchorModeRef.current = false;
          userScrollIntentRef.current = false;
          if (userScrollIntentTimerRef.current) {
            clearTimeout(userScrollIntentTimerRef.current);
            userScrollIntentTimerRef.current = null;
          }
          updateSpacerHeight();
        }
        isAutoFollowRef.current = true;
        return;
      }

      if (isStreaming) {
        isAutoFollowRef.current = false;
      }
    };

    container.addEventListener("pointerdown", markUserScrollIntent, { passive: true });
    container.addEventListener("mousedown", markUserScrollIntent, { passive: true });
    container.addEventListener("touchstart", markUserScrollIntent, { passive: true });
    container.addEventListener("wheel", markUserScrollIntent, { passive: true });
    container.addEventListener("touchmove", markUserScrollIntent, { passive: true });
    container.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("keydown", markKeyboardScrollIntent);
    handleScroll();

    return () => {
      container.removeEventListener("pointerdown", markUserScrollIntent);
      container.removeEventListener("mousedown", markUserScrollIntent);
      container.removeEventListener("touchstart", markUserScrollIntent);
      container.removeEventListener("wheel", markUserScrollIntent);
      container.removeEventListener("touchmove", markUserScrollIntent);
      container.removeEventListener("scroll", handleScroll);
      window.removeEventListener("keydown", markKeyboardScrollIntent);
      if (userScrollIntentTimerRef.current) {
        clearTimeout(userScrollIntentTimerRef.current);
        userScrollIntentTimerRef.current = null;
      }
      userScrollIntentRef.current = false;
    };
  }, [isStreaming, updateSpacerHeight]);

  useEffect(() => {
    const handleResize = () => {
      updateSpacerHeight();
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [updateSpacerHeight]);

  useEffect(() => {
    return () => {
      pendingScrollToUserMessage.current = false;
      if (userScrollIntentTimerRef.current) {
        clearTimeout(userScrollIntentTimerRef.current);
        userScrollIntentTimerRef.current = null;
      }
      userScrollIntentRef.current = false;
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
