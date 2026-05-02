import React, { memo, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { ThinkingBlock } from '@/components/Chat/features/Messages/components/ThinkingBlock';
import { extractThinkingSections } from '@/components/Chat/features/Layout/chatAssistantMarkdownParsing';
import { createMarkdownComponents } from './markdownRendererComponents';
import {
  CHAT_MARKDOWN_REHYPE_PLUGINS,
  CHAT_MARKDOWN_REMARK_PLUGINS,
} from './markdownPipeline';

interface MarkdownRendererProps {
  content: string;
  imageGallery?: Array<{ id: string; src: string }>;
  getImageGallery?: () => Array<{ id: string; src: string }>;
  imageIdBase?: string;
  codeBlockIdBase?: string;
  copiedCodeBlockId?: string | null;
  onCopyCodeBlock?: (blockId: string) => void;
  size?: 'sm' | 'md' | 'lg';
  startTime?: Date;
}

const PROSE_SIZE_CLASS: Record<NonNullable<MarkdownRendererProps['size']>, string> = {
  lg: 'prose-lg',
  md: '',
  sm: 'prose-sm',
};

const MarkdownRenderer: React.FC<MarkdownRendererProps> = memo(
  ({
    content,
    imageGallery,
    getImageGallery,
    imageIdBase,
    codeBlockIdBase,
    copiedCodeBlockId,
    onCopyCodeBlock,
    size,
    startTime,
  }) => {
    const { body: thinking, isComplete: isThinkingDone, markdown } = useMemo(() => {
      const sections = extractThinkingSections(content || '');
      return {
        body: sections.body || null,
        isComplete: sections.isComplete,
        markdown: sections.markdown,
      };
    }, [content]);

    const components = createMarkdownComponents({
      codeBlockIdBase,
      copiedCodeBlockId,
      getImageGallery,
      imageGallery,
      imageIdBase,
      onCopyCodeBlock,
    });

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
            data-chat-selection-surface="true"
            className={[
              'max-w-full break-words prose prose-neutral prose-headings:font-semibold prose-pre:m-0 prose-pre:bg-transparent prose-pre:p-0 dark:prose-invert',
              PROSE_SIZE_CLASS[size ?? 'md'],
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <ReactMarkdown
              remarkPlugins={CHAT_MARKDOWN_REMARK_PLUGINS}
              rehypePlugins={CHAT_MARKDOWN_REHYPE_PLUGINS}
              components={components}
            >
                {markdown}
            </ReactMarkdown>
          </div>
        )}
      </div>
    );
  },
);

export default MarkdownRenderer;
