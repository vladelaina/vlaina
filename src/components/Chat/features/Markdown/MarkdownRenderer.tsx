import React, { memo, useMemo } from "react";
import { Streamdown, defaultRemarkPlugins } from "streamdown";
import remarkMath from "remark-math";
import remarkCitationParser from "@/lib/ai/plugins/remarkCitationParser";
import { ThinkingBlock } from "@/components/Chat/features/Messages/components/ThinkingBlock";
import { CodeBlock } from "./components/CodeBlock";

interface MarkdownRendererProps {
  content: string;
  isStreaming?: boolean;
  size?: "sm" | "md" | "lg";
  browserToolResult?: any;
  startTime?: Date;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = memo(
  ({ content, size, startTime, isStreaming = false }) => {
    
    const { thinking, markdown, isThinkingDone } = useMemo(() => {
        const text = content || "";
        const thinkStart = text.indexOf('<think>');
        
        if (thinkStart === -1) {
            return { thinking: null, markdown: text, isThinkingDone: true };
        }

        const thinkEnd = text.indexOf('</think>');
        
        if (thinkEnd === -1) {
            const thinking = text.substring(thinkStart + 7);
            return { thinking, markdown: "", isThinkingDone: false }; 
        }

        const thinking = text.substring(thinkStart + 7, thinkEnd);
        const markdown = text.substring(0, thinkStart) + text.substring(thinkEnd + 8);
        
        return { thinking, markdown, isThinkingDone: true };
    }, [content]);

    const remarkPlugins = useMemo(
      () =>
        [defaultRemarkPlugins.gfm, remarkMath, remarkCitationParser].filter(
          Boolean,
        ),
      [],
    );

    return (
      <div className="flex flex-col">
        {thinking !== null && (
            <ThinkingBlock 
                content={thinking} 
                isStreaming={!isThinkingDone} 
                startTime={startTime}
            />
        )}
        
        {markdown && (
            <div
                className={`
                max-w-full
                ${size === "sm" ? "prose-sm" : size === "lg" ? "prose-lg" : ""}
                prose prose-neutral dark:prose-invert
                prose-headings:font-semibold
                prose-pre:bg-transparent prose-pre:p-0 prose-pre:m-0
                break-words
                `}
            >
                <Streamdown
                parseIncompleteMarkdown={isStreaming}
                isAnimating={isStreaming}
                controls={false}
                remarkPlugins={remarkPlugins}
                components={{
                    code({ className, children, ...props }: any) {
                      const match = /language-(\w+)/.exec(className || "");
                      const isInline = !match && !String(children).includes("\n");
                      
                      if (isInline) {
                          return (
                          <code className="bg-neutral-100 dark:bg-neutral-800 rounded px-1 py-0.5 text-sm" {...props}>
                              {children}
                          </code>
                          );
                      }

                      return (
                          <CodeBlock className={className} isStreaming={isStreaming} {...props}>
                            {children}
                          </CodeBlock>
                      );
                    },
                }}
                >
                {markdown}
                </Streamdown>
            </div>
        )}
      </div>
    );
  }
);

export default MarkdownRenderer;
