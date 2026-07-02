import React, { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { ThinkingBlock } from '@/components/Chat/features/Messages/components/ThinkingBlock';
import { extractThinkingSections } from '@/components/Chat/features/Layout/chatAssistantMarkdownParsing';
import { createMarkdownComponents } from './markdownRendererComponents';
import {
  CHAT_MARKDOWN_REHYPE_PLUGINS,
  CHAT_MARKDOWN_REMARK_PLUGINS,
} from '@/components/common/markdown/markdownPipeline';
import { canAnimateChatStreamContent, useChatStreamBlocks } from './chatStreamTextAnimation';
import { createChatStreamTextPlugin } from './chatStreamTextPlugin';
import { getChatContentWidth } from '@/components/Chat/features/Layout/chatWidthBuckets';
import {
  addChatSelectionStreamFreezeListener,
} from '@/components/Chat/features/Messages/components/chatSelectionStreamFreeze';
import {
  serializeChatHeadingDragPayload,
  CHAT_HEADING_DRAG_MIME,
  MAX_HEADING_DRAG_TEXT_CHARS,
} from '@/lib/drag/chatHeadingDrag';
import 'katex/dist/katex.min.css';
import '@/components/common/markdown/markdownSurface.css';
import { readonlyMarkdownUrlTransform } from '@/components/common/markdown/urlTransform';
import { compactLargeDataImageMarkdown, scrubChatInlineDataImageSyntax } from './chatInlineImageTokens';
import { themeUiFeedbackTokens } from '@/styles/themeTokens';
import { MAX_CHAT_MARKDOWN_RENDER_CHARS } from './chatMarkdownRenderLimits';

export interface MarkdownRendererProps {
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

export const MAX_CHAT_MARKDOWN_SELECTION_TEXT_NODES = 2_000;

function rangeHasSelectedText(range: Range): boolean {
  const root = range.commonAncestorContainer;
  if (root.nodeType === Node.TEXT_NODE) {
    const text = root.textContent ?? '';
    const start = root === range.startContainer ? range.startOffset : 0;
    const end = root === range.endContainer ? range.endOffset : text.length;
    return /\S/.test(text.slice(start, end));
  }

  const ownerDocument = root.ownerDocument ?? document;
  const walker = ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let scannedTextNodes = 0;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    scannedTextNodes += 1;
    if (scannedTextNodes > MAX_CHAT_MARKDOWN_SELECTION_TEXT_NODES) {
      return true;
    }
    try {
      if (!range.intersectsNode(node)) {
        continue;
      }
    } catch {
      continue;
    }

    const text = node.textContent ?? '';
    const start = node === range.startContainer ? range.startOffset : 0;
    const end = node === range.endContainer ? range.endOffset : text.length;
    if (/\S/.test(text.slice(start, end))) {
      return true;
    }
  }

  return false;
}

function hasActiveSelectionText(): boolean {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    return false;
  }
  for (let index = 0; index < selection.rangeCount; index += 1) {
    try {
      if (rangeHasSelectedText(selection.getRangeAt(index))) {
        return true;
      }
    } catch {
      return true;
    }
  }
  return false;
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

function getBoundedElementText(element: Element, maxChars: number): string | null {
  const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const chunks: string[] = [];
  let length = 0;
  let scannedTextNodes = 0;

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    scannedTextNodes += 1;
    if (scannedTextNodes > MAX_CHAT_MARKDOWN_SELECTION_TEXT_NODES) {
      return null;
    }
    const text = node.textContent ?? '';
    length += text.length;
    if (length > maxChars) {
      return null;
    }
    chunks.push(text);
  }

  return chunks.join('').trim();
}

function getBoundedSelectionText(selection: Selection, maxChars: number): string | null {
  const chunks: string[] = [];
  let length = 0;
  let scannedTextNodes = 0;

  for (let rangeIndex = 0; rangeIndex < selection.rangeCount; rangeIndex += 1) {
    const range = selection.getRangeAt(rangeIndex);
    const root = range.commonAncestorContainer;
    if (root.nodeType === Node.TEXT_NODE) {
      const text = root.textContent ?? '';
      const start = root === range.startContainer ? range.startOffset : 0;
      const end = root === range.endContainer ? range.endOffset : text.length;
      const selected = text.slice(start, end);
      length += selected.length;
      if (length > maxChars) return null;
      chunks.push(selected);
      continue;
    }

    const ownerDocument = root.ownerDocument ?? document;
    const walker = ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      scannedTextNodes += 1;
      if (scannedTextNodes > MAX_CHAT_MARKDOWN_SELECTION_TEXT_NODES) {
        return null;
      }
      try {
        if (!range.intersectsNode(node)) {
          continue;
        }
      } catch {
        continue;
      }

      const text = node.textContent ?? '';
      const start = node === range.startContainer ? range.startOffset : 0;
      const end = node === range.endContainer ? range.endOffset : text.length;
      const selected = text.slice(start, end);
      length += selected.length;
      if (length > maxChars) return null;
      chunks.push(selected);
    }
  }

  return chunks.join('').trim();
}

function getSelectedMarkdownHeadingDragPayload(target: EventTarget | null): { level: number; text: string } | null {
  const element = getElementFromEventTarget(target);
  if (!element) return null;

  const heading = element.closest('h1,h2,h3,h4,h5,h6');
  if (!(heading instanceof HTMLElement)) return null;

  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;

  const selectedText = getBoundedSelectionText(selection, MAX_HEADING_DRAG_TEXT_CHARS);
  const headingText = getBoundedElementText(heading, MAX_HEADING_DRAG_TEXT_CHARS);
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

const MarkdownContent = memo(function MarkdownContent({
  componentOptions,
  markdown,
  shouldAnimateStream,
  streamBlocks,
}: MarkdownContentProps) {
  const components = useMemo(
    () => createMarkdownComponents(componentOptions),
    [componentOptions],
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
    const contentWidthMeasureRafRef = useRef<number | null>(null);
    latestStreamingRef.current = isStreaming;
    if (isStreaming && suspendStreamAnimation) {
      suspendedStreamContentRef.current ??= content;
    } else {
      suspendedStreamContentRef.current = null;
    }
    const renderedContent =
      selectionFrozenContentRef.current ?? suspendedStreamContentRef.current ?? content;
    const compactedContent = useMemo(
      () => renderedContent.length > MAX_CHAT_MARKDOWN_RENDER_CHARS
        ? {
            markdown: scrubChatInlineDataImageSyntax(renderedContent),
            imageSrcByToken: new Map<string, string>(),
            replaced: 0,
          }
        : compactLargeDataImageMarkdown(renderedContent),
      [renderedContent],
    );

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
      if (hasActiveSelectionText()) {
        return;
      }
      releaseSelectionFreezeTimeoutRef.current = window.setTimeout(() => {
        releaseSelectionFreezeTimeoutRef.current = null;
        if (isPointerSelectingRef.current) {
          return;
        }
        releaseSelectionFreeze('selection-grace');
      }, themeUiFeedbackTokens.chatThinkingSelectionReleaseDelayMs);
    }, [clearReleaseSelectionFreezeTimeout, releaseSelectionFreeze]);

    const unlockSelectionContentIfIdle = useCallback(() => {
      if (isPointerSelectingRef.current) {
        return;
      }
      if (!selectionFrozenContentRef.current) {
        return;
      }

      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || selection.rangeCount === 0 || !hasActiveSelectionText()) {
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
      }, themeUiFeedbackTokens.chatThinkingSelectionSettleDelayMs);
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
        CHAT_HEADING_DRAG_MIME,
        serializeChatHeadingDragPayload(payload),
      );
    }, []);

    const { body: thinking, isComplete: isThinkingDone, markdown } = useMemo(() => {
      const sections = extractThinkingSections(compactedContent.markdown || '');
      return {
        body: sections.body || null,
        isComplete: sections.isComplete,
        markdown: sections.markdown,
      };
    }, [compactedContent.markdown]);

    const componentOptions = useMemo<Parameters<typeof createMarkdownComponents>[0]>(() => ({
      codeBlockIdBase,
      copiedCodeBlockId,
      getImageGallery,
      imageGallery,
      imageIdBase,
      imageSrcByToken: compactedContent.imageSrcByToken,
      onCopyCodeBlock,
    }), [
      codeBlockIdBase,
      copiedCodeBlockId,
      getImageGallery,
      imageGallery,
      imageIdBase,
      compactedContent.imageSrcByToken,
      onCopyCodeBlock,
    ]);

    const hasMarkdownSurface = markdown.length > 0;
    const shouldAnimateStream = isStreaming && canAnimateChatStreamContent(markdown);

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
      const scheduleMeasure = () => {
        if (contentWidthMeasureRafRef.current !== null) {
          return;
        }

        contentWidthMeasureRafRef.current = requestAnimationFrame(() => {
          contentWidthMeasureRafRef.current = null;
          measure();
        });
      };

      measure();

      if (typeof ResizeObserver === 'undefined') {
        return;
      }

      const observer = new ResizeObserver(scheduleMeasure);
      observer.observe(surface);

      return () => {
        if (contentWidthMeasureRafRef.current !== null) {
          cancelAnimationFrame(contentWidthMeasureRafRef.current);
          contentWidthMeasureRafRef.current = null;
        }
        observer.disconnect();
      };
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
              'markdown-surface max-w-full break-words',
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
