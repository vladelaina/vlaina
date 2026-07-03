import { memo, useMemo, type RefObject } from "react";
import ReactMarkdown from "react-markdown";
import {
  CHAT_MARKDOWN_REHYPE_PLUGINS,
  CHAT_MARKDOWN_REMARK_PLUGINS,
} from "@/components/common/markdown/markdownPipeline";
import { readonlyMarkdownUrlTransform } from "@/components/common/markdown/urlTransform";
import { createMarkdownComponents } from "@/components/Chat/features/Markdown/markdownRendererComponents";
import { useChatStreamBlocks } from "@/components/Chat/features/Markdown/chatStreamTextAnimation";
import { createChatStreamTextPlugin } from "@/components/Chat/features/Markdown/chatStreamTextPlugin";
import { MAX_CHAT_MARKDOWN_RENDER_CHARS } from "@/components/Chat/features/Markdown/chatMarkdownRenderLimits";

interface ThinkingMarkdownContentProps {
  componentOptions: Parameters<typeof createMarkdownComponents>[0];
  freezeRef: RefObject<boolean>;
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

export const ThinkingMarkdownContent = memo(function ThinkingMarkdownContent({
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
