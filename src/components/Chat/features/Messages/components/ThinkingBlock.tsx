import {
  memo,
  useCallback,
  useEffect,
  useMemo,
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
import { canAnimateChatStreamContent, useChatStreamBlocks } from "@/components/Chat/features/Markdown/chatStreamTextAnimation";
import { createChatStreamTextPlugin } from "@/components/Chat/features/Markdown/chatStreamTextPlugin";
import { getChatContentWidth } from "@/components/Chat/features/Layout/chatWidthBuckets";
import { MAX_CHAT_MARKDOWN_RENDER_CHARS } from "@/components/Chat/features/Markdown/chatMarkdownRenderLimits";
import { PrimerLightbulbIcon } from "@/components/ui/icons/custom/mit/PrimerLightbulbIcon";
import {
  addChatSelectionStreamFreezeListener,
} from "./chatSelectionStreamFreeze";
import { themeDomStyleTokens, themeIconTokens, themeStyleResetTokens, themeUiFeedbackTokens } from "@/styles/themeTokens";
import "@/components/common/markdown/markdownSurface.css";

export const MAX_THINKING_SELECTION_TEXT_NODES = 2_000;

function rangeHasSelectedText(range: Range): boolean {
  const root = range.commonAncestorContainer;
  if (root.nodeType === Node.TEXT_NODE) {
    const text = root.textContent ?? '';
    const start = root === range.startContainer ? range.startOffset : 0;
    const end = root === range.endContainer ? range.endOffset : text.length;
    return /\S/.test(text.slice(start, end));
  }

  const ownerDocument = root.ownerDocument ?? document;
  const walker = ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let scannedTextNodes = 0;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    scannedTextNodes += 1;
    if (scannedTextNodes > MAX_THINKING_SELECTION_TEXT_NODES) {
      return true;
    }
    try {
      if (!range.intersectsNode(node)) {
        continue;
      }
    } catch {
      continue;
    }

    const text = node.textContent ?? '';
    const start = node === range.startContainer ? range.startOffset : 0;
    const end = node === range.endContainer ? range.endOffset : text.length;
    if (/\S/.test(text.slice(start, end))) {
      return true;
    }
  }

  return false;
}

function hasActiveSelectionText(): boolean {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    return false;
  }
  for (let index = 0; index < selection.rangeCount; index += 1) {
    try {
      if (rangeHasSelectedText(selection.getRangeAt(index))) {
        return true;
      }
    } catch {
      return true;
    }
  }
  return false;
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
  componentOptions: Parameters<typeof createMarkdownComponents>[0];
  freezeRef: React.RefObject<boolean>;
  isStreaming: boolean;
  renderedThinking: string;
  streamBlocks: ReturnType<typeof useChatStreamBlocks>;
}

interface StreamingThinkingMarkdownBlockProps {
  block: ReturnType<typeof useChatStreamBlocks>[number];
  componentOptions: Parameters<typeof createMarkdownComponents>[0];
}

const StreamingThinkingMarkdownBlock = memo(function StreamingThinkingMarkdownBlock({
  block,
  componentOptions,
}: StreamingThinkingMarkdownBlockProps) {
  const components = useMemo(() => createMarkdownComponents({
    ...componentOptions,
    codeBlockIndexOffset: block.codeBlockIndexOffset,
    imageIndexOffset: block.imageIndexOffset,
  }), [block.codeBlockIndexOffset, block.imageIndexOffset, componentOptions]);
  const rehypePlugins = useMemo(() => [
    ...CHAT_MARKDOWN_REHYPE_PLUGINS,
    [createChatStreamTextPlugin, {
      births: block.births,
      charDelay: block.charDelay,
      nowMs: block.nowMs,
      revealed: block.revealed,
    }],
  ], [block.births, block.charDelay, block.nowMs, block.revealed]);

  if (block.content.length > MAX_CHAT_MARKDOWN_RENDER_CHARS) {
    return (
      <div data-chat-markdown-too-large="true" className="whitespace-pre-wrap">
        {block.content}
      </div>
    );
  }

  return (
    <ReactMarkdown
      remarkPlugins={CHAT_MARKDOWN_REMARK_PLUGINS}
      rehypePlugins={rehypePlugins}
      components={components}
      urlTransform={readonlyMarkdownUrlTransform}
    >
      {block.content}
    </ReactMarkdown>
  );
}, (prevProps, nextProps) => (
  prevProps.block === nextProps.block &&
  prevProps.componentOptions === nextProps.componentOptions
));

const ThinkingMarkdownContent = memo(function ThinkingMarkdownContent({
  componentOptions,
  isStreaming,
  renderedThinking,
  streamBlocks,
}: ThinkingMarkdownContentProps) {
  const components = useMemo(
    () => createMarkdownComponents(componentOptions),
    [componentOptions],
  );

  if (renderedThinking.length > MAX_CHAT_MARKDOWN_RENDER_CHARS) {
    return (
      <div data-chat-markdown-too-large="true" className="whitespace-pre-wrap">
        {renderedThinking}
      </div>
    );
  }

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
        <StreamingThinkingMarkdownBlock
          key={block.key}
          block={block}
          componentOptions={componentOptions}
        />
      ))}
    </>
  );
}, (prevProps, nextProps) => {
  if (nextProps.freezeRef.current) {
    return true;
  }
  return (
    prevProps.componentOptions === nextProps.componentOptions &&
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
  const contentMetricsRafRef = useRef<number | null>(null);
  const beginSelectionFreezeRef = useRef<(target: EventTarget | null, button: number) => void>(() => {});
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
  const componentOptions = useMemo<Parameters<typeof createMarkdownComponents>[0]>(() => ({
    codeBlockIdBase: "thinking-code",
  }), []);

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
    if (hasActiveSelectionText()) {
      return;
    }
    releaseSelectionFreezeTimeoutRef.current = window.setTimeout(() => {
      releaseSelectionFreezeTimeoutRef.current = null;
      if (isPointerSelectingRef.current) {
        return;
      }
      releaseSelectionFreeze('selection-grace');
    }, themeUiFeedbackTokens.chatThinkingSelectionReleaseDelayMs);
  };

  beginSelectionFreezeRef.current = (target: EventTarget | null, button: number) => {
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
    beginSelectionFreezeRef.current(event.target, event.button);
  };

  const handleSelectionMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    beginSelectionFreezeRef.current(event.target, event.button);
  };

  useEffect(() => {
    return addChatSelectionStreamFreezeListener(({ button, target }) => {
      beginSelectionFreezeRef.current(target, button);
    });
  }, []);

  const clearSelectionFreezeIfIdle = () => {
    if (isPointerSelectingRef.current) {
      return;
    }
    if (!selectionFrozenThinkingRef.current) {
      return;
    }

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0 || !hasActiveSelectionText()) {
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
    }, themeUiFeedbackTokens.chatThinkingSelectionSettleDelayMs);
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
            className={`h-4 w-4 absolute top-0 left-0 ${
              isCollapsed
                ? "-rotate-90 opacity-[var(--vlaina-opacity-0)] group-hover/thinking:opacity-[var(--vlaina-opacity-100)]"
                : "rotate-0 opacity-[var(--vlaina-opacity-100)]"
            }`}
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
