import React, { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkCitationParser from "@/lib/ai/plugins/remarkCitationParser";
import CopyButton from "./CopyButton";
import type { BundledLanguage } from "shiki";
import { highlighter } from "@/lib/highlighter";

interface StreamingMarkdownContentProps {
  content: string;
  isStreaming?: boolean;
  size?: "sm" | "md" | "lg";
  browserToolResult?: any;
}

const extractText = (node: React.ReactNode): string => {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (!node) return "";
  if (React.isValidElement(node)) {
    const props = node.props as any;
    if (props?.children) {
      return extractText(props.children as React.ReactNode);
    }
  }
  if (Array.isArray(node)) {
    return node.map(extractText).join("");
  }
  return "";
};

const CodeBlock = memo(({ className, children }: any) => {
  const match = /language-(\w+)/.exec(className || "");
  const language = match ? match[1] : "";
  const codeText = String(children).replace(/\n$/, "");

  const tokens = React.useMemo(() => {
    if (!highlighter || !highlighter.codeToTokensBase) return null;
    try {
      return {
        light: highlighter.codeToTokensBase(codeText, {
          lang: language as BundledLanguage,
          theme: "one-light" as any,
        }),
        dark: highlighter.codeToTokensBase(codeText, {
          lang: language as BundledLanguage,
          theme: "one-dark" as any,
        }),
      };
    } catch (e) {
      return null;
    }
  }, [codeText, language]);

  return (
    <div className="relative bg-neutral-100 dark:bg-neutral-800 rounded-2xl overflow-hidden my-6">
      <div className="flex select-none">
        {language && (
          <div className="text-[13px] text-neutral-500 dark:text-neutral-400 font-mono px-4 py-2">
            {language}
          </div>
        )}
        <CopyButton
          content={codeText}
          showLabels={true}
          className="copy-button text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 ml-auto"
        />
      </div>
      <pre className="dark:hidden m-0 bg-neutral-100 text-sm overflow-x-auto p-4">
        {tokens?.light ? (
          <code className="font-mono text-sm">
            {tokens.light.map((line: any, i: number) => (
              <React.Fragment key={i}>
                {line.map((token: any, j: number) => (
                  <span key={j} style={{ color: token.color }}>{token.content}</span>
                ))}
                {i < tokens.light.length - 1 && "\n"}
              </React.Fragment>
            ))}
          </code>
        ) : (
          <code className={className}>{children}</code>
        )}
      </pre>
      <pre className="hidden dark:block m-0 bg-neutral-800 text-sm overflow-x-auto p-4">
        {tokens?.dark ? (
          <code className="font-mono text-sm">
            {tokens.dark.map((line: any, i: number) => (
              <React.Fragment key={i}>
                {line.map((token: any, j: number) => (
                  <span key={j} style={{ color: token.color }}>{token.content}</span>
                ))}
                {i < tokens.dark.length - 1 && "\n"}
              </React.Fragment>
            ))}
          </code>
        ) : (
          <code className={className}>{children}</code>
        )}
      </pre>
    </div>
  );
});

const StreamingMarkdownContent: React.FC<StreamingMarkdownContentProps> = memo(
  ({ content, isStreaming, size }) => {
    return (
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
            // Custom citation component (if remarkCitationParser produces 'custom-citation' nodes, 
            // ReactMarkdown handles them if they are valid HTML or we map them. 
            // Note: Remark plugins usually transform AST. ReactMarkdown needs 'rehype' to map to HTML tags.
            // For simplicity, if citation parser outputs standard text/links, it works. 
            // If it outputs custom nodes, we might need a rehype plugin or custom handler.
            // Let's assume for now citation might be plain links or simplified.
          }}
        >
          {content || ""}
        </ReactMarkdown>
      </div>
    );
  }
);

export default StreamingMarkdownContent;