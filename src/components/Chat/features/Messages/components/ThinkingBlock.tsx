import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
} from "react";
import { canAnimateChatStreamContent, useChatStreamBlocks } from "@/components/Chat/features/Markdown/chatStreamTextAnimation";
import { getChatContentWidth } from "@/components/Chat/features/Layout/chatWidthBuckets";
import { PrimerLightbulbIcon } from "@/components/ui/icons/custom/mit/PrimerLightbulbIcon";
import { ThinkingMarkdownContent } from "./ThinkingMarkdownContent";
import {
  MAX_THINKING_SELECTION_TEXT_NODES,
  useThinkingStreamSelection,
} from "./useThinkingStreamSelection";
import { themeDomStyleTokens, themeIconTokens, themeStyleResetTokens } from "@/styles/themeTokens";
import "@/components/common/markdown/markdownSurface.css";

export { MAX_THINKING_SELECTION_TEXT_NODES };

interface ThinkingBlockProps {
  content: string;
  isStreaming: boolean;
  isMessageStreaming?: boolean;
  startTime?: Date;
  endTime?: Date;
  suspendStreamAnimation?: boolean;
}

export function ThinkingBlock({
  content: thinking,
  isStreaming: activelyThinking,
  isMessageStreaming = activelyThinking,
  startTime,
  suspendStreamAnimation = false,
}: ThinkingBlockProps) {
  const [isCollapsed, setIsCollapsed] = useState(() => !activelyThinking);
  const [contentHeight, setContentHeight] = useState<number>(0);
  const [hasOverflow, setHasOverflow] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [contentWidth, setContentWidth] = useState(0);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const observedContentRef = useRef<HTMLDivElement | null>(null);
  const syncContentHeightRef = useRef<() => void>(() => {});
  const syncContentWidthRef = useRef<() => void>(() => {});
  const contentMetricsRafRef = useRef<number | null>(null);
  const {
    handleSelectionMouseDown,
    handleSelectionPointerDown,
    renderedThinking,
    selectionRenderFrozenRef,
    selectionStreamClockPausedRef,
  } = useThinkingStreamSelection({
    activelyThinking,
    contentRef,
    isMessageStreaming,
    suspendStreamAnimation,
    thinking,
  });
  const shouldAnimateThinkingStream = activelyThinking && canAnimateChatStreamContent(renderedThinking);

  syncContentHeightRef.current = () => {
    if (contentRef.current) {
      const nextHeight = contentRef.current.scrollHeight;
      if (nextHeight <= 0) {
        return;
      }

      setContentHeight((current) => (current === nextHeight ? current : nextHeight));
    }
  };
  syncContentWidthRef.current = () => {
    if (contentRef.current) {
      if (contentRef.current.clientWidth <= 0) {
        return;
      }

      const nextWidth = getChatContentWidth(contentRef.current.clientWidth);
      setContentWidth((current) => (current === nextWidth ? current : nextWidth));
    }
  };

  const cancelScheduledContentMetricsSync = useCallback(() => {
    if (contentMetricsRafRef.current !== null) {
      cancelAnimationFrame(contentMetricsRafRef.current);
      contentMetricsRafRef.current = null;
    }
  }, []);

  const scheduleContentMetricsSync = useCallback(() => {
    if (contentMetricsRafRef.current !== null) {
      return;
    }

    contentMetricsRafRef.current = requestAnimationFrame(() => {
      contentMetricsRafRef.current = null;
      syncContentHeightRef.current();
      syncContentWidthRef.current();
    });
  }, []);

  useEffect(() => {
    setIsCollapsed(!activelyThinking);
  }, [activelyThinking]);

  useEffect(() => {
    if (typeof ResizeObserver === "undefined") {
      syncContentHeightRef.current();
      syncContentWidthRef.current();
      return;
    }

    const content = contentRef.current;
    if (!content || observedContentRef.current === content) {
      syncContentHeightRef.current();
      syncContentWidthRef.current();
      return;
    }

    resizeObserverRef.current?.disconnect();
    const resizeObserver = new ResizeObserver(() => {
      scheduleContentMetricsSync();
    });
    resizeObserver.observe(content);
    resizeObserverRef.current = resizeObserver;
    observedContentRef.current = content;
    syncContentHeightRef.current();
    syncContentWidthRef.current();
  }, [scheduleContentMetricsSync]);

  useEffect(() => {
    if (isCollapsed || !activelyThinking) {
      syncContentHeightRef.current();
    }
  }, [activelyThinking, isCollapsed, renderedThinking]);

  useEffect(() => {
    if (isCollapsed && contentRef.current && wrapperRef.current) {
      requestAnimationFrame(() => {
        if (!contentRef.current || !wrapperRef.current) return;
        const cHeight = contentRef.current.scrollHeight;
        const wHeight = wrapperRef.current.clientHeight;
        if (cHeight > wHeight) {
          const translateY = -(cHeight - wHeight);
          contentRef.current.style.transform = `translateY(${translateY}px)`;
          setHasOverflow(true);
        } else {
          contentRef.current.style.transform = "translateY(var(--vlaina-translate-0))";
          setHasOverflow(false);
        }
      });
    } else if (contentRef.current) {
      contentRef.current.style.transform = "translateY(var(--vlaina-translate-0))";
      setHasOverflow(false);
    }
  }, [renderedThinking, isCollapsed]);

  useEffect(() => {
    if (activelyThinking && wrapperRef.current && !isCollapsed) {
      wrapperRef.current.scrollTop = wrapperRef.current.scrollHeight;
    }
  }, [renderedThinking, activelyThinking, isCollapsed]);

  const streamBlocks = useChatStreamBlocks(
    renderedThinking,
    shouldAnimateThinkingStream,
    contentWidth,
    startTime,
    suspendStreamAnimation,
    selectionStreamClockPausedRef,
  );
  const componentOptions = useMemo(() => ({
    codeBlockIdBase: "thinking-code",
  }), []);

  const handleToggle = () => {
    setIsCollapsed((collapsed) => !collapsed);
  };

  useEffect(() => {
    return () => {
      cancelScheduledContentMetricsSync();
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      observedContentRef.current = null;
    };
  }, [cancelScheduledContentMetricsSync]);

  const getMaxHeight = () => {
    if (isCollapsed) {
      return themeDomStyleTokens.sizeZeroPx;
    }
    return contentHeight ? `${contentHeight}px` : themeStyleResetTokens.maxSizeNone;
  };

  const titleText = activelyThinking ? "Reasoning..." : "Reasoned";

  return (
    <div
      data-chat-thinking-block="true"
      className={`flex mb-4 flex-col w-full ${activelyThinking || !isCollapsed ? "text-[var(--vlaina-text-primary)]" : "text-[var(--vlaina-text-secondary)]"}
         hover:text-[var(--vlaina-text-primary)]`}
    >
      <button
        type="button"
        data-chat-selection-excluded="true"
        data-no-focus-input="true"
        aria-expanded={!isCollapsed}
        className="flex items-center cursor-pointer group/thinking self-start relative border-0 bg-transparent p-0 py-1 text-left text-inherit"
        onClick={handleToggle}
      >
        <div className="relative w-4 h-4 mr-2">
          <PrimerLightbulbIcon
            className={`h-4 w-4 absolute left-0 top-0 ${
              isCollapsed ? "opacity-[var(--vlaina-opacity-100)]" : "opacity-[var(--vlaina-opacity-0)]"
            } group-hover/thinking:opacity-[var(--vlaina-opacity-0)]`}
          />
          {/* Chevron glyph adapted from Lucide Icons (ISC). */}
          <svg
            aria-hidden="true"
            className={`h-4 w-4 absolute top-0 left-0 ${
              isCollapsed
                ? "-rotate-90 opacity-[var(--vlaina-opacity-0)] group-hover/thinking:opacity-[var(--vlaina-opacity-100)]"
                : "rotate-0 opacity-[var(--vlaina-opacity-100)]"
            }`}
            focusable="false"
            viewBox={themeIconTokens.viewBoxDefault}
            fill={themeStyleResetTokens.fillNone}
            stroke={themeStyleResetTokens.currentColor}
            strokeWidth={themeIconTokens.strokeDefault}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
        <span className="text-[var(--vlaina-font-15)] font-medium">
          {titleText}
        </span>
      </button>
      <div
        ref={wrapperRef}
        data-chat-thinking-collapsed={isCollapsed ? "true" : undefined}
        className={`text-[var(--vlaina-font-15)] text-[var(--vlaina-text-secondary)] rounded-md
          relative mt-1 ml-6
          ${isCollapsed ? "overflow-hidden" : "overflow-y-auto"}`}
        style={{
          maxHeight: isCollapsed ? getMaxHeight() : undefined,
          opacity: isCollapsed ? 0 : 1,
        }}
      >
        <div
          ref={contentRef}
          data-chat-selection-surface={isCollapsed ? undefined : "true"}
          data-chat-selection-start={isCollapsed ? undefined : "true"}
          data-chat-markdown-live={shouldAnimateThinkingStream ? "true" : undefined}
          data-chat-thinking-content="true"
          onPointerDownCapture={handleSelectionPointerDown}
          onMouseDownCapture={handleSelectionMouseDown}
          className={[
            "markdown-surface opacity-[var(--vlaina-opacity-90)] max-w-none",
            isCollapsed ? "select-none" : "select-text",
            shouldAnimateThinkingStream ? "chat-markdown-live" : "",
          ].filter(Boolean).join(" ")}
        >
          <ThinkingMarkdownContent
            componentOptions={componentOptions}
            freezeRef={selectionRenderFrozenRef}
            isStreaming={shouldAnimateThinkingStream}
            renderedThinking={renderedThinking}
            streamBlocks={streamBlocks}
          />
        </div>
        {isCollapsed && hasOverflow && (
          <div className="absolute inset-x-0 -top-1 h-8 pointer-events-none bg-gradient-to-b from-[var(--vlaina-bg-primary)] to-transparent" />
        )}
      </div>
    </div>
  );
}
