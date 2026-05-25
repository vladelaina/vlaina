import {
  memo,
  useEffect,
  useState,
  useRef,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import ReactMarkdown from "react-markdown";
import {
  CHAT_MARKDOWN_REHYPE_PLUGINS,
  CHAT_MARKDOWN_REMARK_PLUGINS,
} from "@/components/common/markdown/markdownPipeline";
import { readonlyMarkdownUrlTransform } from "@/components/common/markdown/urlTransform";
import { createMarkdownComponents } from "@/components/Chat/features/Markdown/markdownRendererComponents";
import { useChatStreamBlocks } from "@/components/Chat/features/Markdown/chatStreamTextAnimation";
import { createChatStreamTextPlugin } from "@/components/Chat/features/Markdown/chatStreamTextPlugin";
import { getChatContentWidth } from "@/components/Chat/features/Layout/chatWidthBuckets";
import { PrimerLightbulbIcon } from "@/components/ui/icons/custom/mit/PrimerLightbulbIcon";
import {
  addChatSelectionStreamFreezeListener,
} from "./chatSelectionStreamFreeze";
import "@/components/common/markdown/markdownSurface.css";

const STREAM_SELECTION_RELEASE_DELAY_MS = 250;
const STREAM_SELECTION_SETTLE_DELAY_MS = 120;

function getActiveSelectionTextLength(): number {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    return 0;
  }
  return selection.toString().length;
}

function selectionIntersectsElement(element: Element | null): boolean {
  const selection = window.getSelection();
  if (!element || !selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return false;
  }

  for (let index = 0; index < selection.rangeCount; index += 1) {
    try {
      if (selection.getRangeAt(index).intersectsNode(element)) {
        return true;
      }
    } catch {
      return true;
    }
  }
  return false;
}

interface ThinkingBlockProps {
  content: string;
  isStreaming: boolean;
  isMessageStreaming?: boolean;
  startTime?: Date;
  endTime?: Date;
  suspendStreamAnimation?: boolean;
}

interface ThinkingMarkdownContentProps {
  components: ReturnType<typeof createMarkdownComponents>;
  freezeRef: React.RefObject<boolean>;
  isStreaming: boolean;
  renderedThinking: string;
  streamBlocks: ReturnType<typeof useChatStreamBlocks>;
}

const ThinkingMarkdownContent = memo(function ThinkingMarkdownContent({
  components,
  isStreaming,
  renderedThinking,
  streamBlocks,
}: ThinkingMarkdownContentProps) {
  if (!isStreaming) {
    return (
      <ReactMarkdown
        remarkPlugins={CHAT_MARKDOWN_REMARK_PLUGINS}
        rehypePlugins={CHAT_MARKDOWN_REHYPE_PLUGINS}
        components={components}
        urlTransform={readonlyMarkdownUrlTransform}
      >
        {renderedThinking}
      </ReactMarkdown>
    );
  }

  return (
    <>
      {streamBlocks.map((block) => (
        <ReactMarkdown
          key={block.key}
          remarkPlugins={CHAT_MARKDOWN_REMARK_PLUGINS}
          rehypePlugins={[
            ...CHAT_MARKDOWN_REHYPE_PLUGINS,
            [createChatStreamTextPlugin, {
              births: block.births,
              charDelay: block.charDelay,
              nowMs: block.nowMs,
              revealed: block.revealed,
            }],
          ]}
          components={components}
          urlTransform={readonlyMarkdownUrlTransform}
        >
          {block.content}
        </ReactMarkdown>
      ))}
    </>
  );
}, (prevProps, nextProps) => {
  if (nextProps.freezeRef.current) {
    return true;
  }
  return (
    prevProps.components === nextProps.components &&
    prevProps.isStreaming === nextProps.isStreaming &&
    prevProps.renderedThinking === nextProps.renderedThinking &&
    prevProps.streamBlocks === nextProps.streamBlocks
  );
});

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
  const [, bumpSelectionFreezeRevision] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [contentWidth, setContentWidth] = useState(0);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const observedContentRef = useRef<HTMLDivElement | null>(null);
  const suspendedThinkingRef = useRef<string | null>(null);
  const selectionFrozenThinkingRef = useRef<string | null>(null);
  const isPointerSelectingRef = useRef(false);
  const selectionRenderFrozenRef = useRef(false);
  const selectionStreamClockPausedRef = useRef(false);
  const unlockTimeoutRef = useRef<number | null>(null);
  const releaseSelectionFreezeTimeoutRef = useRef<number | null>(null);
  const messageStreamingRef = useRef(isMessageStreaming);
  const syncContentHeightRef = useRef<() => void>(() => {});
  const syncContentWidthRef = useRef<() => void>(() => {});
  messageStreamingRef.current = isMessageStreaming;
  if (!isMessageStreaming) {
    selectionFrozenThinkingRef.current = null;
    isPointerSelectingRef.current = false;
    selectionRenderFrozenRef.current = false;
    selectionStreamClockPausedRef.current = false;
  }
  if (activelyThinking && suspendStreamAnimation) {
    suspendedThinkingRef.current ??= thinking;
  } else {
    suspendedThinkingRef.current = null;
  }
  const renderedThinking =
    selectionFrozenThinkingRef.current ?? suspendedThinkingRef.current ?? thinking;

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
      syncContentHeightRef.current();
      syncContentWidthRef.current();
    });
    resizeObserver.observe(content);
    resizeObserverRef.current = resizeObserver;
    observedContentRef.current = content;
    syncContentHeightRef.current();
    syncContentWidthRef.current();
  }, []);

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
          contentRef.current.style.transform = "translateY(0)";
          setHasOverflow(false);
        }
      });
    } else if (contentRef.current) {
      contentRef.current.style.transform = "translateY(0)";
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
    activelyThinking,
    contentWidth,
    startTime,
    suspendStreamAnimation,
    selectionStreamClockPausedRef,
  );
  const markdownComponents = createMarkdownComponents({ codeBlockIdBase: "thinking-code" });

  const handleToggle = () => {
    setIsCollapsed((collapsed) => !collapsed);
  };

  const clearReleaseSelectionFreezeTimeout = () => {
    if (releaseSelectionFreezeTimeoutRef.current === null) {
      return;
    }
    window.clearTimeout(releaseSelectionFreezeTimeoutRef.current);
    releaseSelectionFreezeTimeoutRef.current = null;
  };

  const clearUnlockTimeout = () => {
    if (unlockTimeoutRef.current === null) {
      return;
    }
    window.clearTimeout(unlockTimeoutRef.current);
    unlockTimeoutRef.current = null;
  };

  const releaseSelectionFreeze = (_reason: string) => {
    if (selectionFrozenThinkingRef.current === null) {
      return;
    }
    selectionFrozenThinkingRef.current = null;
    selectionRenderFrozenRef.current = false;
    selectionStreamClockPausedRef.current = false;
    bumpSelectionFreezeRevision((revision) => revision + 1);
  };

  const scheduleSelectionFreezeRelease = () => {
    clearReleaseSelectionFreezeTimeout();
    if (!messageStreamingRef.current) {
      releaseSelectionFreeze('not-streaming');
      return;
    }
    if (getActiveSelectionTextLength() > 0) {
      return;
    }
    releaseSelectionFreezeTimeoutRef.current = window.setTimeout(() => {
      releaseSelectionFreezeTimeoutRef.current = null;
      if (isPointerSelectingRef.current) {
        return;
      }
      releaseSelectionFreeze('selection-grace');
    }, STREAM_SELECTION_RELEASE_DELAY_MS);
  };

  const beginSelectionFreeze = (target: EventTarget | null, button: number) => {
    const isThinkingTarget =
      target instanceof Element &&
      !!contentRef.current?.contains(target);
    if (!isMessageStreaming || button !== 0 || !isThinkingTarget) {
      return;
    }

    clearReleaseSelectionFreezeTimeout();
    isPointerSelectingRef.current = true;
    selectionRenderFrozenRef.current = true;
    selectionStreamClockPausedRef.current = activelyThinking;
    if (selectionFrozenThinkingRef.current !== thinking) {
      selectionFrozenThinkingRef.current = thinking;
    }
  };

  const handleSelectionPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    beginSelectionFreeze(event.target, event.button);
  };

  const handleSelectionMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    beginSelectionFreeze(event.target, event.button);
  };

  useEffect(() => {
    return addChatSelectionStreamFreezeListener(({ button, target }) => {
      beginSelectionFreeze(target, button);
    });
  });

  const clearSelectionFreezeIfIdle = () => {
    if (isPointerSelectingRef.current) {
      return;
    }
    if (!selectionFrozenThinkingRef.current) {
      return;
    }

    const selection = window.getSelection();
    const selectedTextLength = selection?.toString().length ?? 0;
    if (!selection || selection.isCollapsed || selection.rangeCount === 0 || selectedTextLength === 0) {
      clearReleaseSelectionFreezeTimeout();
      releaseSelectionFreeze('collapsed');
      return;
    }
    if (!selectionIntersectsElement(contentRef.current)) {
      clearReleaseSelectionFreezeTimeout();
      releaseSelectionFreeze('selection-outside');
      return;
    }

    scheduleSelectionFreezeRelease();
  };

  const scheduleClearSelectionFreezeIfIdle = () => {
    clearUnlockTimeout();
    unlockTimeoutRef.current = window.setTimeout(() => {
      unlockTimeoutRef.current = null;
      clearSelectionFreezeIfIdle();
    }, STREAM_SELECTION_SETTLE_DELAY_MS);
  };

  useEffect(() => {
    const handlePointerUp = () => {
      isPointerSelectingRef.current = false;
      scheduleClearSelectionFreezeIfIdle();
    };
    const handleSelectionChange = () => {
      if (isPointerSelectingRef.current) {
        return;
      }
      scheduleClearSelectionFreezeIfIdle();
    };
    document.addEventListener("pointerup", handlePointerUp, true);
    document.addEventListener("selectionchange", handleSelectionChange);
    return () => {
      document.removeEventListener("pointerup", handlePointerUp, true);
      document.removeEventListener("selectionchange", handleSelectionChange);
      clearUnlockTimeout();
      clearReleaseSelectionFreezeTimeout();
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      observedContentRef.current = null;
    };
  }, []);

  const getMaxHeight = () => {
    if (isCollapsed) {
      return "0px";
    }
    return contentHeight ? `${contentHeight}px` : "none";
  };

  const titleText = activelyThinking ? "Thought..." : "Reasoning";

  return (
    <div
      data-chat-thinking-block="true"
      className={`flex mb-4 flex-col w-full ${activelyThinking || !isCollapsed ? "text-neutral-800 dark:text-neutral-200" : "text-neutral-600 dark:text-neutral-400"}
         hover:text-neutral-800 dark:hover:text-neutral-200`}
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
              isCollapsed ? "opacity-100" : "opacity-0"
            } group-hover/thinking:opacity-0`}
          />
          {/* Chevron glyph adapted from Lucide Icons (ISC). */}
          <svg
            className={`h-4 w-4 absolute top-0 left-0 ${
              isCollapsed
                ? "-rotate-90 opacity-0 group-hover/thinking:opacity-100"
                : "rotate-0 opacity-100"
            }`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
        <span className="text-[15px] font-medium">
          {titleText}
        </span>
      </button>
      <div
        ref={wrapperRef}
        data-chat-thinking-collapsed={isCollapsed ? "true" : undefined}
        className={`text-[15px] text-neutral-500 dark:text-neutral-400 rounded-md
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
          data-chat-markdown-live={activelyThinking ? "true" : undefined}
          data-chat-thinking-content="true"
          onPointerDownCapture={handleSelectionPointerDown}
          onMouseDownCapture={handleSelectionMouseDown}
          className={[
            "vlaina-markdown-surface opacity-90 max-w-none",
            isCollapsed ? "select-none" : "select-text",
            activelyThinking ? "chat-markdown-live" : "",
          ].filter(Boolean).join(" ")}
        >
          <ThinkingMarkdownContent
            components={markdownComponents}
            freezeRef={selectionRenderFrozenRef}
            isStreaming={activelyThinking}
            renderedThinking={renderedThinking}
            streamBlocks={streamBlocks}
          />
        </div>
        {isCollapsed && hasOverflow && (
          <div className="absolute inset-x-0 -top-1 h-8 pointer-events-none bg-gradient-to-b from-white dark:from-neutral-900 to-transparent" />
        )}
      </div>
    </div>
  );
}
