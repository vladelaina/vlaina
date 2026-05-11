import { useMemo, useRef } from 'react';
import {
  materializeRichInlineLineRange,
  measureRichInlineStats,
  walkRichInlineLineRanges,
  type RichInlineLineRange,
} from '@/lib/text-layout';
import { getPreparedMarkdownTextBlock } from '@/components/Chat/features/Layout/chatAssistantInlineMarkdown';
import { parseMarkdownMeasurementBlocks } from '@/components/Chat/features/Layout/chatAssistantMarkdownBlockParser';
import { CHAT_STREAM_FADE_MS } from './chatStreamTextPlugin';
import { MARKDOWN_BLOCK_GAP } from '@/components/common/markdown/markdownMetrics';

const BASE_CHAR_DELAY_MS = 20;
const MIN_CHAR_DELAY_MS = 20;
const MIN_ADAPTIVE_CHAR_DELAY_MS = 1;
const MAX_ADAPTIVE_CHAR_DELAY_MS = 18;
const MIN_APPEND_WINDOW_MS = 35;
const MAX_APPEND_WINDOW_MS = 260;
const APPEND_WINDOW_RATIO = 0.75;
const FALLBACK_CONTENT_WIDTH = 640;

export interface ChatStreamBlock {
  births: number[];
  charDelay: number;
  codeBlockIndexOffset: number;
  content: string;
  imageIndexOffset: number;
  key: string;
  nowMs: number;
  revealed: boolean;
}

const MIN_STABLE_PREFIX_CHARS = 160;

function now(): number {
  return typeof performance === 'undefined' ? Date.now() : performance.now();
}

function computeCharDelay(queueLength: number): number {
  const accelerated = BASE_CHAR_DELAY_MS / (1 + queueLength * 0.3);
  return Math.max(MIN_CHAR_DELAY_MS, accelerated);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function textLength(text: string): number {
  return Array.from(text).length;
}

function findStableMarkdownSplit(content: string): number {
  const splitIndex = content.lastIndexOf('\n\n');
  if (splitIndex <= 0 || splitIndex + 2 >= content.length) {
    return 0;
  }

  const stableSplit = splitIndex + 2;
  return textLength(content.slice(0, stableSplit)) >= MIN_STABLE_PREFIX_CHARS ? stableSplit : 0;
}

function countFencedCodeBlocks(markdown: string): number {
  let count = 0;
  let inFence = false;
  for (const line of markdown.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) {
      if (!inFence) {
        count += 1;
      }
      inFence = !inFence;
    }
  }
  return count;
}

function countMarkdownImages(markdown: string): number {
  return markdown.match(/!\[[^\]]*]\([^)]+\)/g)?.length ?? 0;
}

export function buildChatStreamSchedule(
  content: string,
  contentWidth: number,
  startMs: number,
  renderNow: number = startMs,
): ChatStreamBlock {
  const scheduleWidth = contentWidth > 0 ? contentWidth : FALLBACK_CONTENT_WIDTH;
  const parsedBlocks = parseMarkdownMeasurementBlocks(content);
  const blocks = parsedBlocks.some((block) => block.kind === 'text')
    ? parsedBlocks
    : [{
        kind: 'text' as const,
        extraHeight: 0,
        lineHeight: 0,
        prepared: getPreparedMarkdownTextBlock(content, 'body'),
        widthInset: 0,
      }];
  const births: number[] = [];
  // Seed the first visible character slightly in the past so the first paint
  // does not land entirely inside the transparent window.
  let cursor = startMs - CHAT_STREAM_FADE_MS;

  for (let blockIndex = 0; blockIndex < blocks.length; blockIndex += 1) {
    const block = blocks[blockIndex]!;
    if (block.kind !== 'text') {
      continue;
    }

    const availableWidth = Math.max(1, Math.floor(scheduleWidth - block.widthInset));
    const lineCount = Math.max(1, measureRichInlineStats(block.prepared, availableWidth).lineCount);
    let lineIndex = 0;

    walkRichInlineLineRanges(block.prepared, availableWidth, (line: RichInlineLineRange) => {
      const materializedLine = materializeRichInlineLineRange(block.prepared, line);
      const lineText = materializedLine.fragments.map((fragment) => fragment.text).join('');
      const chars = Array.from(lineText);
      const lineDelay = computeCharDelay(Math.max(0, lineCount - lineIndex - 1));

      for (let charIndex = 0; charIndex < chars.length; charIndex += 1) {
        births.push(cursor + charIndex * lineDelay);
      }

      if (chars.length > 0) {
        cursor = births[births.length - 1]! + CHAT_STREAM_FADE_MS;
      }

      lineIndex += 1;
    });

    if (blockIndex < blocks.length - 1 && births.length > 0) {
      cursor += MARKDOWN_BLOCK_GAP;
    }
  }

  return {
    births,
    charDelay: BASE_CHAR_DELAY_MS,
    codeBlockIndexOffset: 0,
    content,
    imageIndexOffset: 0,
    key: 'stream',
    nowMs: renderNow,
    revealed: births.length === 0 || renderNow - (births.at(-1) ?? renderNow) >= CHAT_STREAM_FADE_MS,
  };
}

export function useChatStreamBlocks(
  content: string,
  enabled: boolean,
  _contentWidth: number = 0,
  _streamStartTime?: Date,
  _suspendClock: boolean = false,
  _pauseClockRef?: { readonly current: boolean },
): ChatStreamBlock[] {
  const renderNow = now();
  const previousContentRef = useRef(content);
  const previousContentLengthRef = useRef(textLength(content));
  const previousArrivalTimeRef = useRef(renderNow);
  const birthsRef = useRef<number[]>(Array.from(content).map(() => renderNow - CHAT_STREAM_FADE_MS));
  const charDelayRef = useRef(0);
  const stableBlockRef = useRef<ChatStreamBlock | null>(null);

  return useMemo(() => {
    if (!enabled) {
      previousContentRef.current = content;
      previousContentLengthRef.current = textLength(content);
      birthsRef.current = Array.from(content).map(() => renderNow - CHAT_STREAM_FADE_MS);
      charDelayRef.current = 0;
      stableBlockRef.current = null;
      const blocks = content ? [{
        births: [],
        charDelay: BASE_CHAR_DELAY_MS,
        codeBlockIndexOffset: 0,
        content,
        imageIndexOffset: 0,
        key: 'static',
        nowMs: renderNow,
        revealed: true,
      }] : [];
      return blocks;
    }

    const previousContent = previousContentRef.current;
    const previousLength = previousContentLengthRef.current;

    if (content !== previousContent) {
      if (content.startsWith(previousContent)) {
        const appendedText = content.slice(previousContent.length);
        const appendedLength = textLength(appendedText);
        const nextLength = previousLength + appendedLength;
        const elapsedSinceLastAppend = Math.max(1, renderNow - previousArrivalTimeRef.current);
        const appendWindow = clamp(
          elapsedSinceLastAppend * APPEND_WINDOW_RATIO,
          MIN_APPEND_WINDOW_MS,
          MAX_APPEND_WINDOW_MS,
        );
        const charDelay = appendedLength > 1
          ? clamp(appendWindow / (appendedLength - 1), MIN_ADAPTIVE_CHAR_DELAY_MS, MAX_ADAPTIVE_CHAR_DELAY_MS)
          : 0;
        const firstBirth = renderNow - Math.min(CHAT_STREAM_FADE_MS * 0.35, appendWindow * 0.5);

        birthsRef.current.length = previousLength;
        for (let index = 0; index < appendedLength; index += 1) {
          birthsRef.current.push(firstBirth + index * charDelay);
        }
        charDelayRef.current = charDelay;
        previousContentLengthRef.current = nextLength;
      } else {
        birthsRef.current = Array.from(content).map(() => renderNow - CHAT_STREAM_FADE_MS);
        charDelayRef.current = 0;
        previousContentLengthRef.current = textLength(content);
      }

      previousContentRef.current = content;
      previousArrivalTimeRef.current = renderNow;
    }

    const lastBirth = birthsRef.current.at(-1) ?? renderNow;
    const stableSplit = findStableMarkdownSplit(content);
    if (stableSplit > 0) {
      const stableContent = content.slice(0, stableSplit);
      const activeContent = content.slice(stableSplit);
      const stableCharLength = textLength(stableContent);
      const stableKey = `stable:${stableCharLength}`;
      const stableBlock =
        stableBlockRef.current?.key === stableKey && stableBlockRef.current.content === stableContent
          ? stableBlockRef.current
          : {
              births: [],
              charDelay: 0,
              codeBlockIndexOffset: 0,
              content: stableContent,
              imageIndexOffset: 0,
              key: stableKey,
              nowMs: renderNow,
              revealed: true,
            };
      stableBlockRef.current = stableBlock;

      return [
        stableBlock,
        {
          births: birthsRef.current.slice(stableCharLength),
          charDelay: charDelayRef.current,
          codeBlockIndexOffset: countFencedCodeBlocks(stableContent),
          content: activeContent,
          imageIndexOffset: countMarkdownImages(stableContent),
          key: 'stream',
          nowMs: renderNow,
          revealed: birthsRef.current.length === 0 || renderNow - lastBirth >= CHAT_STREAM_FADE_MS,
        },
      ];
    }

    stableBlockRef.current = null;

    return [{
      births: birthsRef.current,
      charDelay: charDelayRef.current,
      codeBlockIndexOffset: 0,
      content,
      imageIndexOffset: 0,
      key: 'stream',
      nowMs: renderNow,
      revealed: birthsRef.current.length === 0 || renderNow - lastBirth >= CHAT_STREAM_FADE_MS,
    }];
  }, [content, enabled, renderNow]);
}
