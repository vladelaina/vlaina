import { useEffect, useState, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

interface ThinkingBlockProps {
  content: string;
  isStreaming: boolean;
  startTime?: Date;
  endTime?: Date;
}

export function ThinkingBlock({
  content: thinking,
  isStreaming: activelyThinking,
  startTime,
  endTime,
}: ThinkingBlockProps) {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [contentHeight, setContentHeight] = useState<number>(0);
  const [hasOverflow, setHasOverflow] = useState(false);
  const [internalEndTime, setInternalEndTime] = useState<Date | undefined>(endTime);
  const contentRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (endTime) {
      setInternalEndTime(endTime);
    } else if (!activelyThinking && !internalEndTime) {
      setInternalEndTime(new Date());
    }
  }, [activelyThinking, endTime, internalEndTime]);

  const finishedThinking = !activelyThinking;

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
    if (contentRef.current) {
      const resizeObserver = new ResizeObserver(() => {
        if (contentRef.current) {
          setContentHeight(contentRef.current.scrollHeight);
        }
      });
      resizeObserver.observe(contentRef.current);
      return () => resizeObserver.disconnect();
    }
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
    setIsCollapsed(!isCollapsed);
    setHasUserInteracted(true);
  };

  const getMaxHeight = () => {
    if (isCollapsed) {
      return finishedThinking ? "0px" : "12rem";
    }
    return contentHeight ? `${contentHeight}px` : "none";
  };

  const getDurationText = () => {
    if (activelyThinking) return "Thinking...";
    if (startTime && internalEndTime) {
      const durationMs = Math.max(0, internalEndTime.getTime() - startTime.getTime());
      if (durationMs >= 1000) {
        const seconds = (durationMs / 1000).toFixed(1).replace(/\.0$/, "");
        return `Thought for ${seconds}s`;
      }
    }
    return "Thought briefly";
  };

  return (
    <div
      className={`flex mb-4 flex-col w-full ${activelyThinking || !isCollapsed ? "text-neutral-800 dark:text-neutral-200" : "text-neutral-600 dark:text-neutral-400"}
         hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors select-none`}
    >
      <div
        className="flex items-center cursor-pointer group/thinking self-start relative py-1"
        onClick={handleToggle}
      >
        <div className="relative w-4 h-4 mr-2">
          <svg
            className={`w-3 absolute left-0.5 top-1/2 -translate-y-1/2 transition-opacity duration-300 ${
              isCollapsed ? "opacity-100" : "opacity-0"
            } group-hover/thinking:opacity-0 fill-current`}
            viewBox="0 0 14 24"
          >
            <path d="M0 6.01562C0 9.76562 2.24609 10.6934 2.87109 17.207C2.91016 17.5586 3.10547 17.7832 3.47656 17.7832H9.58984C9.9707 17.7832 10.166 17.5586 10.2051 17.207C10.8301 10.6934 13.0664 9.76562 13.0664 6.01562C13.0664 2.64648 10.1855 0 6.5332 0C2.88086 0 0 2.64648 0 6.01562ZM1.47461 6.01562C1.47461 3.37891 3.78906 1.47461 6.5332 1.47461C9.27734 1.47461 11.5918 3.37891 11.5918 6.01562C11.5918 8.81836 9.73633 9.48242 8.85742 16.3086H4.21875C3.33008 9.48242 1.47461 8.81836 1.47461 6.01562ZM3.44727 19.8926H9.62891C9.95117 19.8926 10.1953 19.6387 10.1953 19.3164C10.1953 19.0039 9.95117 18.75 9.62891 18.75H3.44727C3.125 18.75 2.87109 19.0039 2.87109 19.3164C2.87109 19.6387 3.125 19.8926 3.44727 19.8926ZM6.5332 22.7246C8.04688 22.7246 9.30664 21.9824 9.4043 20.8594H3.67188C3.74023 21.9824 5.00977 22.7246 6.5332 22.7246Z" />
          </svg>
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
        <h3 className="text-[15px] font-medium">
          {getDurationText()}
        </h3>
      </div>
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
          className="transition-transform duration-300 opacity-90 select-text leading-relaxed prose prose-neutral dark:prose-invert max-w-none"
        >
          <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]}>
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
