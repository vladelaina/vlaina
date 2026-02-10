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

export const useMessageAutoscroll = ({
  messages,
  isStreaming,
  chatId,
}: UseMessageAutoscrollOptions): MessageAutoscrollBehavior => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pendingScrollToUserMessage = useRef(false);
  const [spacerHeight, setSpacerHeight] = useState(0);
  const lastScrollHeightRef = useRef(0);
  const lastScrollTopRef = useRef(0);
  const [isActiveInteraction, setIsActiveInteraction] = useState(false);
  const [hasSubmittedMessage, setHasSubmittedMessage] = useState(false);
  const prevChatIdRef = useRef<string | null>(chatId);

  const getLastUserMessageIndex = useCallback(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        return i;
      }
    }
    return -1;
  }, [messages]);

  const scrollToMessage = useCallback((messageIndex: number) => {
    if (!containerRef.current || messageIndex < 0) {
      return;
    }

    const container = containerRef.current;
    const targetElement = container.querySelector(
      `[data-message-index="${messageIndex}"]`,
    ) as HTMLElement | null;

    if (!targetElement) return;

    const containerHeight = container.clientHeight;
    const containerStyle = window.getComputedStyle(container);
    const paddingTop = parseFloat(containerStyle.paddingTop) || 0;
    const scrollHeight = container.scrollHeight;
    const messageHeight = targetElement.offsetHeight;

    const isLarge = messageHeight > containerHeight * 0.7;

    let targetPosition: number = targetElement.offsetTop - paddingTop;

    if (isLarge) {
      targetPosition = scrollHeight - containerHeight;
    }

    const maxScroll = scrollHeight - containerHeight;
    const finalPosition = Math.min(Math.max(0, targetPosition), maxScroll);

    container.scrollTo({
      top: finalPosition,
      behavior: "smooth",
    });
  }, []);

  const updateSpacerHeight = useCallback(() => {
    if (!containerRef.current) {
      return;
    }

    const containerHeight = containerRef.current.clientHeight;
    const lastUserIndex = getLastUserMessageIndex();

    if (lastUserIndex < 0) {
      setSpacerHeight(0);
      return;
    }

    const messageElements = containerRef.current.querySelectorAll(
      "[data-message-index]",
    ) as NodeListOf<HTMLElement>;

    if (!messageElements || messageElements.length === 0) {
      setSpacerHeight(0);
      return;
    }

    const targetElement = containerRef.current.querySelector(
      `[data-message-index="${lastUserIndex}"]`,
    ) as HTMLElement | null;

    if (!targetElement) {
      setSpacerHeight(0);
      return;
    }

    const elementsAfter = Array.from(messageElements).filter((el) => {
      const idx = Number(el.dataset.messageIndex);
      return Number.isFinite(idx) && idx > lastUserIndex;
    });

    const contentHeightAfterTarget = elementsAfter.reduce(
      (sum, el) => sum + el.offsetHeight,
      0,
    );

    const targetMessageHeight = targetElement.offsetHeight;

    let baseHeight: number;

    if (contentHeightAfterTarget === 0) {
      baseHeight = Math.max(0, containerHeight - targetMessageHeight);
    } else {
      baseHeight = Math.max(
        0,
        containerHeight - contentHeightAfterTarget - targetMessageHeight,
      );
    }

    if (!isActiveInteraction) {
      setSpacerHeight(0);
      return;
    }

    const extraSpaceForAssistant = isStreaming ? containerHeight * 0.4 : 0;
    const calculatedHeight = baseHeight + extraSpaceForAssistant;

    setSpacerHeight(calculatedHeight);
  }, [getLastUserMessageIndex, isStreaming, isActiveInteraction]);

  const handleNewUserMessage = useCallback(() => {
    pendingScrollToUserMessage.current = true;
    setIsActiveInteraction(true);
    setHasSubmittedMessage(true);
  }, []);

  useLayoutEffect(() => {
    if (pendingScrollToUserMessage.current) {
      const targetUserIndex = getLastUserMessageIndex();

      if (targetUserIndex >= 0) {
        requestAnimationFrame(() => {
          updateSpacerHeight();
          requestAnimationFrame(() => {
            scrollToMessage(targetUserIndex);
            pendingScrollToUserMessage.current = false;
          });
        });
      } else {
        pendingScrollToUserMessage.current = false;
        setIsActiveInteraction(isStreaming);
      }
    }
  }, [
    messages,
    getLastUserMessageIndex,
    scrollToMessage,
    updateSpacerHeight,
    isStreaming,
  ]);

  useEffect(() => {
    if (
      isStreaming ||
      pendingScrollToUserMessage.current ||
      hasSubmittedMessage
    ) {
      setIsActiveInteraction(true);
    } else {
      setIsActiveInteraction(false);
    }
  }, [isStreaming, hasSubmittedMessage]);

  useEffect(() => {
    if (prevChatIdRef.current !== chatId) {
      setIsActiveInteraction(false);
      setHasSubmittedMessage(false);
      prevChatIdRef.current = chatId;
    }
  }, [chatId]);

  useEffect(() => {
    updateSpacerHeight();
  }, [messages, updateSpacerHeight]);

  useEffect(() => {
    if (!containerRef.current) return;

    let resizeTimeout: ReturnType<typeof setTimeout>;
    let immediateUpdate = false;

    const resizeObserver = new ResizeObserver((entries) => {
      let hasSignificantChange = false;
      for (const entry of entries) {
        const element = entry.target as HTMLElement;
        if (
          element.dataset.messageIndex &&
          entry.contentRect.height !== element.offsetHeight
        ) {
          const heightDiff = Math.abs(
            entry.contentRect.height - element.offsetHeight,
          );
          if (heightDiff > 50) {
            hasSignificantChange = true;
            break;
          }
        }
      }

      if (hasSignificantChange || immediateUpdate) {
        updateSpacerHeight();
        immediateUpdate = false;
      } else {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
          updateSpacerHeight();
        }, 100);
      }
    });

    const mutationObserver = new MutationObserver((mutations) => {
      const hasToggle = mutations.some(
        (mutation) =>
          mutation.type === "attributes" &&
          (mutation.attributeName === "class" ||
            mutation.attributeName === "style" ||
            mutation.attributeName === "open" ||
            mutation.attributeName === "data-expanded"),
      );

      if (hasToggle) {
        immediateUpdate = true;
        updateSpacerHeight();
      }
    });

    resizeObserver.observe(containerRef.current);
    mutationObserver.observe(containerRef.current, {
      attributes: true,
      subtree: true,
      attributeFilter: ["class", "style", "open", "data-expanded"],
    });

    const messageElements = containerRef.current.querySelectorAll(
      "[data-message-index]",
    );
    messageElements.forEach((element) => {
      resizeObserver.observe(element);
    });

    return () => {
      clearTimeout(resizeTimeout);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [messages, updateSpacerHeight]);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const handleScroll = () => {
      lastScrollTopRef.current = container.scrollTop;
      lastScrollHeightRef.current = container.scrollHeight;
    };

    container.addEventListener("scroll", handleScroll);
    lastScrollTopRef.current = container.scrollTop;
    lastScrollHeightRef.current = container.scrollHeight;

    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return useMemo(
    () => ({
      handleNewUserMessage,
      containerRef,
      spacerHeight,
    }),
    [handleNewUserMessage, containerRef, spacerHeight],
  );
};
