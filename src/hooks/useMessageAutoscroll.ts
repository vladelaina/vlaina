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
    const maxBaseHeight = containerHeight * MAX_BASE_SPACER_RATIO;
    const baseHeight = Math.min(unclampedBaseHeight, maxBaseHeight);

    const extraSpaceForAssistant =
      isStreaming && hasVisibleAssistantOutput
        ? containerHeight * STREAMING_EXTRA_SPACER_RATIO
        : 0;

    setSpacerHeight(Math.max(0, Math.round(baseHeight + extraSpaceForAssistant)));
  }, [getLastUserMessageIndex, hasVisibleAssistantOutput, isStreaming]);

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

      if (isStreaming) {
        isAutoFollowRef.current = false;
      }
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => {
      container.removeEventListener("scroll", handleScroll);
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
