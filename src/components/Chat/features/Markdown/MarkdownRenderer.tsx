import React, { isValidElement, memo, useEffect, useMemo, useState } from "react";
import { Streamdown, defaultRemarkPlugins, defaultRehypePlugins } from "streamdown";
import rehypeSanitize from "rehype-sanitize";
import remarkMath from "remark-math";
import remarkCitationParser from "@/lib/ai/plugins/remarkCitationParser";
import { getExternalLinkProps } from "@/lib/navigation/externalLinks";
import { ThinkingBlock } from "@/components/Chat/features/Messages/components/ThinkingBlock";
import { LocalImage } from "@/components/Chat/common/LocalImage";
import { Icon } from "@/components/ui/icons";
import { cn, iconButtonStyles } from "@/lib/utils";
import { copyImageSourceToClipboard } from "@/components/Chat/common/messageClipboard";
import { downloadImageWithPrompt } from "@/components/Chat/common/imageDownload";
import { ChatImageViewer } from "./components/ChatImageViewer";
import { CodeBlock } from "./components/CodeBlock";
import { createMarkdownSanitizeSchema, normalizeRenderableImageSrc } from "./imagePolicy";

interface MarkdownRendererProps {
  content: string;
  imageGallery?: Array<{ id: string; src: string }>;
  imageIdBase?: string;
  isStreaming?: boolean;
  size?: "sm" | "md" | "lg";
  browserToolResult?: any;
  startTime?: Date;
}

const BLOCK_LEVEL_TAGS = new Set([
  "address",
  "article",
  "aside",
  "blockquote",
  "details",
  "dialog",
  "div",
  "dl",
  "fieldset",
  "figcaption",
  "figure",
  "footer",
  "form",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "hr",
  "li",
  "main",
  "nav",
  "ol",
  "p",
  "pre",
  "section",
  "table",
  "ul",
]);

function hasBlockLevelChild(children: React.ReactNode): boolean {
  const nodes = React.Children.toArray(children);
  for (const node of nodes) {
    if (!isValidElement(node)) continue;

    if (typeof node.type === "string" && BLOCK_LEVEL_TAGS.has(node.type.toLowerCase())) {
      return true;
    }

    const nestedChildren = (node.props as { children?: React.ReactNode }).children;
    if (nestedChildren && hasBlockLevelChild(nestedChildren)) {
      return true;
    }
  }
  return false;
}

function resolvePreCodePayload(children: React.ReactNode): { className?: string; content: React.ReactNode } {
  if (isValidElement(children)) {
    const props = children.props as { className?: string; children?: React.ReactNode };
    return {
      className: props.className,
      content: props.children,
    };
  }
  return {
    className: undefined,
    content: children,
  };
}

async function copyImageOrUrl(src: string): Promise<void> {
  const copied = await copyImageSourceToClipboard(src);
  if (copied) {
    return;
  }
  await navigator.clipboard.writeText(src);
}

function MarkdownImage({
  src,
  alt,
  imageGallery,
  currentImageId,
}: {
  src: string;
  alt?: string;
  imageGallery?: Array<{ id: string; src: string }>;
  currentImageId?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1200);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const handleCopy = async () => {
    try {
      await copyImageOrUrl(src);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <span className="not-prose my-3 block max-w-full" data-no-focus-input="true">
      <span className="group relative inline-block max-w-full overflow-hidden rounded-xl align-top">
        <LocalImage
          src={src}
          alt={alt || "image"}
          className="block max-h-[420px] w-auto max-w-full object-contain"
          onClick={() => {
            setIsViewerOpen(true);
          }}
        />
        <span
          className="absolute right-2 top-2 z-10 flex items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
          data-no-focus-input="true"
        >
          <button
            type="button"
            data-no-focus-input="true"
            aria-label="Copy image"
            onClick={(e) => {
              e.stopPropagation();
              void handleCopy();
            }}
            className={cn(
              "p-1.5",
              iconButtonStyles,
              copied && "text-green-500 dark:text-green-400"
            )}
          >
            <Icon name={copied ? "common.check" : "common.copy"} size="md" />
          </button>
          <button
            type="button"
            data-no-focus-input="true"
            aria-label="Download image"
            onClick={(e) => {
              e.stopPropagation();
              void downloadImageWithPrompt(src, alt);
            }}
            className={cn("p-1.5", iconButtonStyles)}
          >
            <Icon name="common.download" size="md" />
          </button>
        </span>
      </span>
      <ChatImageViewer
        open={isViewerOpen}
        src={src}
        alt={alt}
        gallery={imageGallery}
        currentImageId={currentImageId}
        onOpenChange={setIsViewerOpen}
      />
    </span>
  );
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = memo(
  ({ content, imageGallery, imageIdBase, size, startTime, isStreaming = false }) => {
    
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

    const sanitizeSchema = useMemo(() => createMarkdownSanitizeSchema(), []);

    const rehypePlugins = useMemo(
      () => [defaultRehypePlugins.raw, [rehypeSanitize, sanitizeSchema]] as any[],
      [sanitizeSchema]
    );

    let imageRenderIndex = 0;

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
                rehypePlugins={rehypePlugins}
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
                    code({ className, children, ...props }: any) {
                      return (
                        <code className={cn("bg-neutral-100 dark:bg-neutral-800 rounded px-1 py-0.5 text-sm", className)} {...props}>
                          {children}
                        </code>
                      );
                    },
                    pre({ children, ...props }: any) {
                      const { className, content } = resolvePreCodePayload(children);
                      return (
                        <CodeBlock className={className} isStreaming={isStreaming} {...props}>
                          {content}
                        </CodeBlock>
                      );
                    },
                    p({ children, ...props }: any) {
                      if (hasBlockLevelChild(children)) {
                        return <div {...props}>{children}</div>;
                      }
                      return <p {...props}>{children}</p>;
                    },
                    img({ src, alt }: any) {
                      const safeSrc = normalizeRenderableImageSrc(typeof src === "string" ? src : null);
                      if (!safeSrc) {
                        return (
                          <span className="inline-block rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-500 dark:bg-zinc-800 dark:text-gray-400">
                            [Image unavailable]
                          </span>
                        );
                      }

                      const currentImageId = imageIdBase ? `${imageIdBase}:${imageRenderIndex}` : undefined;
                      imageRenderIndex += 1;

                      return (
                        <MarkdownImage
                          src={safeSrc}
                          alt={typeof alt === "string" ? alt : "image"}
                          imageGallery={imageGallery}
                          currentImageId={currentImageId}
                        />
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
