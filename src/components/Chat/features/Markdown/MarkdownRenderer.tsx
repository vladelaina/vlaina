import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { ThinkingBlock } from '@/components/Chat/features/Messages/components/ThinkingBlock';
import { extractThinkingSections } from '@/components/Chat/features/Layout/chatAssistantMarkdownParsing';
import { createMarkdownComponents } from './markdownRendererComponents';
import {
  CHAT_MARKDOWN_REHYPE_PLUGINS,
  CHAT_MARKDOWN_REMARK_PLUGINS,
} from './markdownPipeline';
import { useChatStreamBlocks } from './chatStreamTextAnimation';
import { createChatStreamTextPlugin } from './chatStreamTextPlugin';

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
  isStreaming?: boolean;
}

const PROSE_SIZE_CLASS: Record<NonNullable<MarkdownRendererProps['size']>, string> = {
  lg: 'prose-lg',
  md: '',
  sm: 'prose-sm',
};

const SELECTION_EXCLUDED_SELECTOR = [
  '[data-chat-selection-excluded="true"]',
  'button',
  '[role="button"]',
  'input',
  'textarea',
  'select',
  'a',
].join(',');

function isSelectionSurfaceTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }

  return (
    !!target.closest('[data-chat-selection-surface="true"]') &&
    !target.closest(SELECTION_EXCLUDED_SELECTOR)
  );
}

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
    isStreaming = false,
  }) => {
    const [selectionLockedContent, setSelectionLockedContent] = useState<string | null>(null);
    const isPointerSelectingRef = useRef(false);
    const unlockTimeoutRef = useRef<number | null>(null);
    const renderedContent = selectionLockedContent ?? content;
    const shouldAnimateStream = isStreaming && selectionLockedContent === null;

    const unlockSelectionContentIfIdle = useCallback(() => {
      if (!selectionLockedContent || isPointerSelectingRef.current) {
        return;
      }

      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
        setSelectionLockedContent(null);
      }
    }, [selectionLockedContent]);

    useEffect(() => {
      if (!isStreaming) {
        isPointerSelectingRef.current = false;
        setSelectionLockedContent(null);
      }
    }, [isStreaming]);

    useEffect(() => {
      return () => {
        if (unlockTimeoutRef.current !== null) {
          window.clearTimeout(unlockTimeoutRef.current);
          unlockTimeoutRef.current = null;
        }
      };
    }, []);

    useEffect(() => {
      if (selectionLockedContent === null) {
        return;
      }

      const handlePointerUp = () => {
        isPointerSelectingRef.current = false;
        if (unlockTimeoutRef.current !== null) {
          window.clearTimeout(unlockTimeoutRef.current);
        }
        unlockTimeoutRef.current = window.setTimeout(() => {
          unlockTimeoutRef.current = null;
          unlockSelectionContentIfIdle();
        }, 0);
      };
      const handleSelectionChange = () => {
        unlockSelectionContentIfIdle();
      };

      document.addEventListener('pointerup', handlePointerUp, true);
      document.addEventListener('selectionchange', handleSelectionChange);
      return () => {
        document.removeEventListener('pointerup', handlePointerUp, true);
        document.removeEventListener('selectionchange', handleSelectionChange);
      };
    }, [selectionLockedContent, unlockSelectionContentIfIdle]);

    const handleSelectionPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
      if (!isStreaming || event.button !== 0 || !isSelectionSurfaceTarget(event.target)) {
        return;
      }

      isPointerSelectingRef.current = true;
      setSelectionLockedContent((current) => current ?? content);
    }, [content, isStreaming]);

    const { body: thinking, isComplete: isThinkingDone, markdown } = useMemo(() => {
      const sections = extractThinkingSections(renderedContent || '');
      return {
        body: sections.body || null,
        isComplete: sections.isComplete,
        markdown: sections.markdown,
      };
    }, [renderedContent]);

    const components = createMarkdownComponents({
      codeBlockIdBase,
      copiedCodeBlockId,
      getImageGallery,
      imageGallery,
      imageIdBase,
      onCopyCodeBlock,
    });
    const streamBlocks = useChatStreamBlocks(markdown, shouldAnimateStream);

    return (
      <div className="flex flex-col" onPointerDownCapture={handleSelectionPointerDown}>
        {thinking !== null && (
          <ThinkingBlock
            content={thinking}
            isStreaming={isStreaming && !isThinkingDone}
            startTime={startTime}
          />
        )}

        {markdown && (
          <div
            data-chat-selection-surface="true"
            data-chat-markdown-live={shouldAnimateStream ? 'true' : undefined}
            className={[
              'max-w-full break-words prose prose-neutral prose-headings:font-semibold prose-pre:m-0 prose-pre:bg-transparent prose-pre:p-0 dark:prose-invert',
              shouldAnimateStream ? 'chat-markdown-live' : '',
              PROSE_SIZE_CLASS[size ?? 'md'],
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {shouldAnimateStream ? (
              streamBlocks.map((block) => (
                <ReactMarkdown
                  key={block.key}
                  remarkPlugins={CHAT_MARKDOWN_REMARK_PLUGINS}
                  rehypePlugins={[
                    ...CHAT_MARKDOWN_REHYPE_PLUGINS,
                    [createChatStreamTextPlugin, {
                      births: block.births,
                      charDelay: block.charDelay,
                      nowMs: block.nowMs,
                      revealed: block.revealed,
                    }],
                  ]}
                  components={components}
                >
                  {block.content}
                </ReactMarkdown>
              ))
            ) : (
              <ReactMarkdown
                remarkPlugins={CHAT_MARKDOWN_REMARK_PLUGINS}
                rehypePlugins={CHAT_MARKDOWN_REHYPE_PLUGINS}
                components={components}
              >
                {markdown}
              </ReactMarkdown>
            )}
          </div>
        )}
      </div>
    );
  },
);

export default MarkdownRenderer;
