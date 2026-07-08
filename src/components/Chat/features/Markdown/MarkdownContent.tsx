import React, { memo, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { createMarkdownComponents } from './markdownRendererComponents';
import {
  CHAT_MARKDOWN_REHYPE_PLUGINS,
  CHAT_MARKDOWN_REMARK_PLUGINS,
} from '@/components/common/markdown/markdownPipeline';
import { readonlyMarkdownUrlTransform } from '@/components/common/markdown/urlTransform';
import { useChatStreamBlocks } from './chatStreamTextAnimation';
import { createChatStreamTextPlugin } from './chatStreamTextPlugin';
import { MAX_CHAT_MARKDOWN_RENDER_CHARS } from './chatMarkdownRenderLimits';
import { useI18n } from '@/lib/i18n';

interface MarkdownContentProps {
  componentOptions: Parameters<typeof createMarkdownComponents>[0];
  freezeRef: React.RefObject<boolean>;
  markdown: string;
  shouldAnimateStream: boolean;
  streamBlocks: ReturnType<typeof useChatStreamBlocks>;
}

interface StreamingMarkdownBlockProps {
  block: ReturnType<typeof useChatStreamBlocks>[number];
  componentOptions: Parameters<typeof createMarkdownComponents>[0];
}

const StreamingMarkdownBlock = memo(function StreamingMarkdownBlock({
  block,
  componentOptions,
}: StreamingMarkdownBlockProps) {
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

export const MarkdownContent = memo(function MarkdownContent({
  componentOptions,
  markdown,
  shouldAnimateStream,
  streamBlocks,
}: MarkdownContentProps) {
  const { t } = useI18n();
  const localizedComponentOptions = useMemo(() => ({
    ...componentOptions,
    unavailableImageLabel: t('chat.imageUnavailable'),
  }), [componentOptions, t]);
  const components = useMemo(
    () => createMarkdownComponents(localizedComponentOptions),
    [localizedComponentOptions],
  );

  if (markdown.length > MAX_CHAT_MARKDOWN_RENDER_CHARS) {
    return (
      <div data-chat-markdown-too-large="true" className="whitespace-pre-wrap">
        {markdown}
      </div>
    );
  }

  if (!shouldAnimateStream) {
    return (
      <ReactMarkdown
        remarkPlugins={CHAT_MARKDOWN_REMARK_PLUGINS}
        rehypePlugins={CHAT_MARKDOWN_REHYPE_PLUGINS}
        components={components}
        urlTransform={readonlyMarkdownUrlTransform}
      >
        {markdown}
      </ReactMarkdown>
    );
  }

  return (
    <>
      {streamBlocks.map((block) => (
        <StreamingMarkdownBlock
          key={block.key}
          block={block}
          componentOptions={localizedComponentOptions}
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
    prevProps.markdown === nextProps.markdown &&
    prevProps.shouldAnimateStream === nextProps.shouldAnimateStream &&
    prevProps.streamBlocks === nextProps.streamBlocks
  );
});
