import React, { memo, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkCitationParser from "@/lib/ai/plugins/remarkCitationParser";
import CopyButton from "./CopyButton";
import { ThinkingBlock } from "./ThinkingBlock";
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';

interface StreamingMarkdownContentProps {
  content: string;
  isStreaming?: boolean;
  size?: "sm" | "md" | "lg";
  browserToolResult?: any;
  startTime?: Date;
}

const CodeBlock = memo(({ className, children }: any) => {
  const match = /language-(\w+)/.exec(className || "");
  const language = match ? match[1] : "";
  const codeText = String(children).replace(/\n$/, "");

  const highlightedHTML = useMemo(() => {
    try {
      if (language && hljs.getLanguage(language)) {
        return hljs.highlight(codeText, { language }).value;
      }
      // Fallback to auto-detection or plain text
      return hljs.highlightAuto(codeText).value;
    } catch (e) {
      return codeText;
    }
  }, [codeText, language]);

  return (
    <div className="relative bg-neutral-100 dark:bg-neutral-800 rounded-2xl overflow-hidden my-6 group">
      <div className="flex select-none px-4 py-2 items-center justify-between">
        <span className="text-[13px] text-neutral-500 dark:text-neutral-400 font-mono">
            {language || 'text'}
        </span>
        <CopyButton
          content={codeText}
          showLabels={false}
          className="text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 transition-colors"
        />
      </div>
      <div className="overflow-x-auto p-4 pt-0">
        <code 
            className={`font-mono text-sm leading-relaxed hljs ${language} !bg-transparent !p-0`}
            dangerouslySetInnerHTML={{ __html: highlightedHTML }}
        />
      </div>
    </div>
  );
});

const StreamingMarkdownContent: React.FC<StreamingMarkdownContentProps> = memo(
  ({ content, size, startTime }) => {
    
    // Parse <think> tags
    const { thinking, markdown, isThinkingDone } = useMemo(() => {
        const text = content || "";
        const thinkStart = text.indexOf('<think>');
        
        if (thinkStart === -1) {
            // No thinking tag found
            return { thinking: null, markdown: text, isThinkingDone: true };
        }

        const thinkEnd = text.indexOf('</think>');
        
        if (thinkEnd === -1) {
            // Still streaming thinking content
            const thinking = text.substring(thinkStart + 7);
            return { thinking, markdown: "", isThinkingDone: false }; 
        }

        const thinking = text.substring(thinkStart + 7, thinkEnd);
        const markdown = text.substring(0, thinkStart) + text.substring(thinkEnd + 8);
        
        return { thinking, markdown, isThinkingDone: true };
    }, [content]);

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
                <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath, remarkCitationParser]}
                components={{
                    code({ node, className, children, ...props }) {
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
                        <CodeBlock className={className} {...props}>
                        {children}
                        </CodeBlock>
                    );
                    },
                }}
                >
                {markdown}
                </ReactMarkdown>
            </div>
        )}
      </div>
    );
  }
);

export default StreamingMarkdownContent;
