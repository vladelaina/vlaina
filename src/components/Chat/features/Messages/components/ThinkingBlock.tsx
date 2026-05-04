import { useEffect, useState, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { getExternalLinkProps } from "@/lib/navigation/externalLinks";
import {
  CHAT_MARKDOWN_REHYPE_PLUGINS,
  CHAT_MARKDOWN_REMARK_PLUGINS,
} from "@/components/Chat/features/Markdown/markdownPipeline";
import { PrimerLightbulbIcon } from "@/components/ui/icons/custom/mit/PrimerLightbulbIcon";

interface ThinkingBlockProps {
  content: string;
  isStreaming: boolean;
  startTime?: Date;
  endTime?: Date;
}

export function ThinkingBlock({
  content: thinking,
  isStreaming: activelyThinking,
}: ThinkingBlockProps) {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [contentHeight, setContentHeight] = useState<number>(0);
  const [hasOverflow, setHasOverflow] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const observedContentRef = useRef<HTMLDivElement | null>(null);
  const syncContentHeightRef = useRef<() => void>(() => {});

  const finishedThinking = !activelyThinking;

  syncContentHeightRef.current = () => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    }
  };

  useEffect(() => {
    if (!activelyThinking && !hasUserInteracted) {
      setIsCollapsed(true);
    }
  }, [activelyThinking, hasUserInteracted]);

  useEffect(() => {
    if (activelyThinking) {
      setHasUserInteracted(false);
      setIsCollapsed(false);
    }
  }, [activelyThinking]);

  useEffect(() => {
    if (typeof ResizeObserver === "undefined") {
      syncContentHeightRef.current();
      return;
    }

    const content = contentRef.current;
    if (!content || observedContentRef.current === content) {
      syncContentHeightRef.current();
      return;
    }

    resizeObserverRef.current?.disconnect();
    const resizeObserver = new ResizeObserver(() => {
      syncContentHeightRef.current();
    });
    resizeObserver.observe(content);
    resizeObserverRef.current = resizeObserver;
    observedContentRef.current = content;
    syncContentHeightRef.current();
  }, [thinking]);

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
  }, [thinking, isCollapsed]);

  useEffect(() => {
    if (activelyThinking && wrapperRef.current && !isCollapsed) {
      wrapperRef.current.scrollTop = wrapperRef.current.scrollHeight;
    }
  }, [thinking, activelyThinking, isCollapsed]);

  const handleToggle = () => {
    setIsCollapsed((collapsed) => !collapsed);
    setHasUserInteracted(true);
  };

  useEffect(() => {
    return () => {
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      observedContentRef.current = null;
    };
  }, []);

  const getMaxHeight = () => {
    if (isCollapsed) {
      return finishedThinking ? "0px" : "12rem";
    }
    return contentHeight ? `${contentHeight}px` : "none";
  };

  const titleText = activelyThinking ? "Thought..." : "Reasoning";

  return (
    <div
      className={`flex mb-4 flex-col w-full ${activelyThinking || !isCollapsed ? "text-neutral-800 dark:text-neutral-200" : "text-neutral-600 dark:text-neutral-400"}
         hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors select-none`}
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
            className={`h-4 w-4 absolute left-0 top-0 transition-opacity duration-300 ${
              isCollapsed ? "opacity-100" : "opacity-0"
            } group-hover/thinking:opacity-0`}
          />
          <svg
            className={`h-4 w-4 absolute top-0 left-0 transition-all duration-300 ${
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
        className={`text-[15px] text-neutral-500 dark:text-neutral-400 rounded-md
          transition-[max-height,opacity] duration-300 ease-in-out relative mt-1 ml-6
          ${isCollapsed ? "overflow-hidden" : "overflow-y-auto"}`}
        style={{
          maxHeight: isCollapsed ? getMaxHeight() : undefined,
          opacity: isCollapsed && finishedThinking ? 0 : 1,
        }}
      >
        <div
          ref={contentRef}
          data-chat-selection-surface="true"
          className="transition-transform duration-300 opacity-90 select-text leading-relaxed prose prose-neutral dark:prose-invert max-w-none"
        >
          <ReactMarkdown
            remarkPlugins={CHAT_MARKDOWN_REMARK_PLUGINS}
            rehypePlugins={CHAT_MARKDOWN_REHYPE_PLUGINS}
            components={{
              a({ href, children, ...props }: any) {
                return (
                  <a
                    {...props}
                    {...getExternalLinkProps(typeof href === "string" ? href : null)}
                    data-no-focus-input="true"
                  >
                    {children}
                  </a>
                );
              },
            }}
          >
            {thinking}
          </ReactMarkdown>
        </div>
        {isCollapsed && hasOverflow && (
          <div className="absolute inset-x-0 -top-1 h-8 pointer-events-none bg-gradient-to-b from-white dark:from-neutral-900 to-transparent" />
        )}
      </div>
    </div>
  );
}
