import React, { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { ThinkingBlock } from '@/components/Chat/features/Messages/components/ThinkingBlock';
import { extractThinkingSections } from '@/components/Chat/features/Layout/chatAssistantMarkdownParsing';
import { createMarkdownComponents } from './markdownRendererComponents';
import {
  CHAT_MARKDOWN_REHYPE_PLUGINS,
  CHAT_MARKDOWN_REMARK_PLUGINS,
} from '@/components/common/markdown/markdownPipeline';
import { useChatStreamBlocks } from './chatStreamTextAnimation';
import { createChatStreamTextPlugin } from './chatStreamTextPlugin';
import { getChatContentWidth } from '@/components/Chat/features/Layout/chatWidthBuckets';
import {
  addChatSelectionStreamFreezeListener,
} from '@/components/Chat/features/Messages/components/chatSelectionStreamFreeze';
import {
  serializeChatHeadingDragPayload,
  VLAINA_CHAT_HEADING_DRAG_MIME,
} from '@/lib/drag/chatHeadingDrag';
import 'katex/dist/katex.min.css';
import '@/components/common/markdown/markdownSurface.css';
import { readonlyMarkdownUrlTransform } from '@/components/common/markdown/urlTransform';

interface MarkdownRendererProps {
  content: string;
  imageGallery?: Array<{ id: string; src: string }>;
  getImageGallery?: () => Array<{ id: string; src: string }>;
  imageIdBase?: string;
  codeBlockIdBase?: string;
  copiedCodeBlockId?: string | null;
  onCopyCodeBlock?: (blockId: string) => void;
  startTime?: Date;
  isStreaming?: boolean;
  suspendStreamAnimation?: boolean;
}

const SELECTION_EXCLUDED_SELECTOR = [
  '[data-chat-selection-excluded="true"]',
  'button',
  '[role="button"]',
  'input',
  'textarea',
  'select',
  'a',
].join(',');
const STREAM_SELECTION_RELEASE_DELAY_MS = 250;
const STREAM_SELECTION_SETTLE_DELAY_MS = 120;

function getActiveSelectionTextLength(): number {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    return 0;
  }
  return selection.toString().length;
}

function selectionIntersectsElement(element: Element | null): boolean {
  const selection = window.getSelection();
  if (!element || !selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return false;
  }

  for (let index = 0; index < selection.rangeCount; index += 1) {
    try {
      if (selection.getRangeAt(index).intersectsNode(element)) {
        return true;
      }
    } catch {
      return true;
    }
  }
  return false;
}

function isSelectionSurfaceTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }

  return (
    !!target.closest('[data-chat-selection-surface="true"]') &&
    !target.closest(SELECTION_EXCLUDED_SELECTOR)
  );
}

function getElementFromEventTarget(target: EventTarget | null): Element | null {
  if (target instanceof Element) return target;
  if (target instanceof Text) return target.parentElement;
  return null;
}

function getSelectedMarkdownHeadingDragPayload(target: EventTarget | null): { level: number; text: string } | null {
  const element = getElementFromEventTarget(target);
  if (!element) return null;

  const heading = element.closest('h1,h2,h3,h4,h5,h6');
  if (!(heading instanceof HTMLElement)) return null;

  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;

  const selectedText = selection.toString().trim();
  const headingText = heading.textContent?.trim() ?? '';
  if (!selectedText || selectedText !== headingText) return null;

  let intersectsHeading = false;
  for (let index = 0; index < selection.rangeCount; index += 1) {
    try {
      if (selection.getRangeAt(index).intersectsNode(heading)) {
        intersectsHeading = true;
      }
    } catch {
      return null;
    }
  }
  if (!intersectsHeading) return null;

  const level = Number(heading.tagName.slice(1));
  if (!Number.isInteger(level) || level < 1 || level > 6) return null;
  return { level, text: headingText };
}

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
  }), [block.codeBlockIndexOffset, block.content, block.imageIndexOffset, componentOptions]);
  const rehypePlugins = useMemo(() => [
    ...CHAT_MARKDOWN_REHYPE_PLUGINS,
    [createChatStreamTextPlugin, {
      births: block.births,
      charDelay: block.charDelay,
      nowMs: block.nowMs,
      revealed: block.revealed,
    }],
  ], [block.births, block.charDelay, block.nowMs, block.revealed]);

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

const MarkdownContent = memo(function MarkdownContent({
  componentOptions,
  markdown,
  shouldAnimateStream,
  streamBlocks,
}: MarkdownContentProps) {
  const components = useMemo(
    () => createMarkdownComponents(componentOptions),
    [componentOptions, markdown],
  );

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
    prevProps.markdown === nextProps.markdown &&
    prevProps.shouldAnimateStream === nextProps.shouldAnimateStream &&
    prevProps.streamBlocks === nextProps.streamBlocks
  );
});

const MarkdownRenderer: React.FC<MarkdownRendererProps> = memo(
  ({
    content,
    imageGallery,
    getImageGallery,
    imageIdBase,
    codeBlockIdBase,
    copiedCodeBlockId,
    onCopyCodeBlock,
    startTime,
    isStreaming = false,
    suspendStreamAnimation = false,
  }) => {
    const [, bumpSelectionFreezeRevision] = useState(0);
    const isPointerSelectingRef = useRef(false);
    const selectionStreamClockPausedRef = useRef(false);
    const unlockTimeoutRef = useRef<number | null>(null);
    const releaseSelectionFreezeTimeoutRef = useRef<number | null>(null);
    const markdownSurfaceRef = useRef<HTMLDivElement | null>(null);
    const latestStreamingRef = useRef(isStreaming);
    const selectionFrozenContentRef = useRef<string | null>(null);
    const suspendedStreamContentRef = useRef<string | null>(null);
    const [contentWidth, setContentWidth] = useState(0);
    latestStreamingRef.current = isStreaming;
    const shouldAnimateStream = isStreaming;
    if (shouldAnimateStream && suspendStreamAnimation) {
      suspendedStreamContentRef.current ??= content;
    } else {
      suspendedStreamContentRef.current = null;
    }
    const renderedContent =
      selectionFrozenContentRef.current ?? suspendedStreamContentRef.current ?? content;

    const clearReleaseSelectionFreezeTimeout = useCallback(() => {
      if (releaseSelectionFreezeTimeoutRef.current === null) {
        return;
      }
      window.clearTimeout(releaseSelectionFreezeTimeoutRef.current);
      releaseSelectionFreezeTimeoutRef.current = null;
    }, []);

    const releaseSelectionFreeze = useCallback((_reason: string) => {
      if (selectionFrozenContentRef.current === null) {
        return;
      }
      selectionFrozenContentRef.current = null;
      selectionStreamClockPausedRef.current = false;
      bumpSelectionFreezeRevision((revision) => revision + 1);
    }, []);

    const scheduleSelectionFreezeRelease = useCallback(() => {
      clearReleaseSelectionFreezeTimeout();
      if (!latestStreamingRef.current) {
        releaseSelectionFreeze('not-streaming');
        return;
      }
      if (getActiveSelectionTextLength() > 0) {
        return;
      }
      releaseSelectionFreezeTimeoutRef.current = window.setTimeout(() => {
        releaseSelectionFreezeTimeoutRef.current = null;
        if (isPointerSelectingRef.current) {
          return;
        }
        releaseSelectionFreeze('selection-grace');
      }, STREAM_SELECTION_RELEASE_DELAY_MS);
    }, [clearReleaseSelectionFreezeTimeout, releaseSelectionFreeze]);

    const unlockSelectionContentIfIdle = useCallback(() => {
      if (isPointerSelectingRef.current) {
        return;
      }
      if (!selectionFrozenContentRef.current) {
        return;
      }

      const selection = window.getSelection();
      const selectedTextLength = selection?.toString().length ?? 0;
      if (!selection || selection.isCollapsed || selection.rangeCount === 0 || selectedTextLength === 0) {
        clearReleaseSelectionFreezeTimeout();
        releaseSelectionFreeze('collapsed');
        return;
      }
      if (!selectionIntersectsElement(markdownSurfaceRef.current)) {
        clearReleaseSelectionFreezeTimeout();
        releaseSelectionFreeze('selection-outside');
        return;
      }
      scheduleSelectionFreezeRelease();
    }, [clearReleaseSelectionFreezeTimeout, releaseSelectionFreeze, scheduleSelectionFreezeRelease]);

    const scheduleUnlockSelectionContentIfIdle = useCallback(() => {
      if (unlockTimeoutRef.current !== null) {
        window.clearTimeout(unlockTimeoutRef.current);
      }
      unlockTimeoutRef.current = window.setTimeout(() => {
        unlockTimeoutRef.current = null;
        unlockSelectionContentIfIdle();
      }, STREAM_SELECTION_SETTLE_DELAY_MS);
    }, [unlockSelectionContentIfIdle]);

    useEffect(() => {
      if (!isStreaming) {
        isPointerSelectingRef.current = false;
        selectionStreamClockPausedRef.current = false;
        clearReleaseSelectionFreezeTimeout();
        if (selectionFrozenContentRef.current !== null) {
          selectionFrozenContentRef.current = null;
          bumpSelectionFreezeRevision((revision) => revision + 1);
        }
      }
    }, [isStreaming]);

    useEffect(() => {
      return () => {
        if (unlockTimeoutRef.current !== null) {
          window.clearTimeout(unlockTimeoutRef.current);
          unlockTimeoutRef.current = null;
        }
        clearReleaseSelectionFreezeTimeout();
      };
    }, [clearReleaseSelectionFreezeTimeout]);

    useEffect(() => {
      const handlePointerUp = () => {
        isPointerSelectingRef.current = false;
        scheduleUnlockSelectionContentIfIdle();
      };

      document.addEventListener('pointerup', handlePointerUp, true);
      return () => {
        document.removeEventListener('pointerup', handlePointerUp, true);
      };
    }, [scheduleUnlockSelectionContentIfIdle]);

    useEffect(() => {
      const handleSelectionChange = () => {
        if (selectionFrozenContentRef.current === null) {
          return;
        }
        if (isPointerSelectingRef.current) {
          return;
        }
        scheduleUnlockSelectionContentIfIdle();
      };

      document.addEventListener('selectionchange', handleSelectionChange);
      return () => {
        document.removeEventListener('selectionchange', handleSelectionChange);
      };
    }, [renderedContent, scheduleUnlockSelectionContentIfIdle]);

    const beginSelectionFreeze = useCallback((
      target: EventTarget | null,
      button: number,
    ) => {
      const isSurfaceTarget =
        isSelectionSurfaceTarget(target) &&
        target instanceof Element &&
        !!markdownSurfaceRef.current?.contains(target);
      if (!isStreaming || button !== 0 || !isSurfaceTarget) {
        return;
      }

      clearReleaseSelectionFreezeTimeout();
      isPointerSelectingRef.current = true;
      selectionStreamClockPausedRef.current = true;
      if (selectionFrozenContentRef.current !== content) {
        selectionFrozenContentRef.current = content;
      }
    }, [clearReleaseSelectionFreezeTimeout, content, isStreaming]);

    useEffect(() => {
      return addChatSelectionStreamFreezeListener(({ button, target }) => {
        beginSelectionFreeze(target, button);
      });
    }, [beginSelectionFreeze]);

    const handleSelectionPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
      beginSelectionFreeze(event.target, event.button);
    }, [beginSelectionFreeze]);

    const handleSelectionMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
      beginSelectionFreeze(event.target, event.button);
    }, [beginSelectionFreeze]);

    const handleMarkdownDragStartCapture = useCallback((event: React.DragEvent<HTMLDivElement>) => {
      const payload = getSelectedMarkdownHeadingDragPayload(event.target);
      if (!payload) return;

      event.dataTransfer.setData(
        VLAINA_CHAT_HEADING_DRAG_MIME,
        serializeChatHeadingDragPayload(payload),
      );
    }, []);

    const { body: thinking, isComplete: isThinkingDone, markdown } = useMemo(() => {
      const sections = extractThinkingSections(renderedContent || '');
      return {
        body: sections.body || null,
        isComplete: sections.isComplete,
        markdown: sections.markdown,
      };
    }, [renderedContent]);

    const componentOptions = useMemo<Parameters<typeof createMarkdownComponents>[0]>(() => ({
      codeBlockIdBase,
      copiedCodeBlockId,
      getImageGallery,
      imageGallery,
      imageIdBase,
      onCopyCodeBlock,
    }), [
      codeBlockIdBase,
      copiedCodeBlockId,
      getImageGallery,
      imageGallery,
      imageIdBase,
      onCopyCodeBlock,
    ]);

    const hasMarkdownSurface = markdown.length > 0;

    useLayoutEffect(() => {
      const surface = markdownSurfaceRef.current;
      if (!surface) {
        return;
      }

      const measure = () => {
        if (surface.clientWidth <= 0) {
          return;
        }

        const nextWidth = getChatContentWidth(surface.clientWidth);
        setContentWidth((current) => (current === nextWidth ? current : nextWidth));
      };

      measure();

      if (typeof ResizeObserver === 'undefined') {
        return;
      }

      const observer = new ResizeObserver(() => {
        measure();
      });
      observer.observe(surface);

      return () => observer.disconnect();
    }, [hasMarkdownSurface]);

    const streamBlocks = useChatStreamBlocks(
      markdown,
      shouldAnimateStream,
      contentWidth,
      startTime,
      suspendStreamAnimation,
      selectionStreamClockPausedRef,
    );

    return (
      <div
        className="flex flex-col"
        onPointerDownCapture={handleSelectionPointerDown}
        onMouseDownCapture={handleSelectionMouseDown}
      >
        {thinking !== null && (
          <ThinkingBlock
            content={thinking}
            isStreaming={isStreaming && !isThinkingDone}
            isMessageStreaming={isStreaming}
            startTime={startTime}
            suspendStreamAnimation={suspendStreamAnimation}
          />
        )}

        {markdown && (
          <div
            ref={markdownSurfaceRef}
            data-chat-selection-surface="true"
            data-chat-selection-start="true"
            data-chat-markdown-live={shouldAnimateStream ? 'true' : undefined}
            onDragStartCapture={handleMarkdownDragStartCapture}
            className={[
              'vlaina-markdown-surface max-w-full break-words',
              shouldAnimateStream ? 'chat-markdown-live' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <MarkdownContent
              componentOptions={componentOptions}
              freezeRef={selectionStreamClockPausedRef}
              markdown={markdown}
              shouldAnimateStream={shouldAnimateStream}
              streamBlocks={streamBlocks}
            />
          </div>
        )}
      </div>
    );
  },
);

export default MarkdownRenderer;
