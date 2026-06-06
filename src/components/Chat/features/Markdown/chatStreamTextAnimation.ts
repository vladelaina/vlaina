import { useMemo, useRef } from 'react';
import {
  materializeRichInlineLineRange,
  measureRichInlineStats,
  walkRichInlineLineRanges,
  type RichInlineLineRange,
} from '@/lib/text-layout';
import { getPreparedMarkdownTextBlock } from '@/components/Chat/features/Layout/chatAssistantInlineMarkdown';
import {
  getMarkdownFenceState,
  isMarkdownFenceClose,
  parseMarkdownMeasurementBlocks,
  type MarkdownFenceState,
} from '@/components/Chat/features/Layout/chatAssistantMarkdownBlockParser';
import { CHAT_STREAM_FADE_MS } from './chatStreamTextPlugin';
import { MARKDOWN_BLOCK_GAP } from '@/components/common/markdown/markdownMetrics';
import { countFencedCodeBlocks, countRenderableImages } from './chatStreamTextMetadata';
import { themeChatStreamTokens, themeTypographyTokens } from '@/styles/themeTokens';
import { createFilledCodePointTimings, getCodePointLength } from './chatStreamTextMetrics';

const BASE_CHAR_DELAY_MS = themeChatStreamTokens.baseCharDelayMs;
const MIN_CHAR_DELAY_MS = themeChatStreamTokens.minCharDelayMs;
const MIN_ADAPTIVE_CHAR_DELAY_MS = themeChatStreamTokens.minAdaptiveCharDelayMs;
const MAX_ADAPTIVE_CHAR_DELAY_MS = themeChatStreamTokens.maxAdaptiveCharDelayMs;
const MIN_APPEND_WINDOW_MS = themeChatStreamTokens.minAppendWindowMs;
const MAX_APPEND_WINDOW_MS = themeChatStreamTokens.maxAppendWindowMs;
const APPEND_WINDOW_RATIO = themeChatStreamTokens.appendWindowRatio;
const FALLBACK_CONTENT_WIDTH = themeChatStreamTokens.fallbackContentWidthPx;
export const MAX_CHAT_STREAM_ANIMATION_CHARS = 20_000;

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

const MIN_STABLE_PREFIX_CHARS = themeChatStreamTokens.minStablePrefixChars;

interface StableMarkdownScanState {
  activeFence: MarkdownFenceState | null;
  charOffset: number;
  content: string;
  offset: number;
  resumeLineStart: number;
  splitIndex: number;
}

interface StableStreamBlockCache {
  block: ChatStreamBlock;
  codeBlockIndexOffset: number;
  imageIndexOffset: number;
}

function now(): number {
  return typeof performance === 'undefined' ? Date.now() : performance.now();
}

function computeCharDelay(queueLength: number): number {
  const accelerated = BASE_CHAR_DELAY_MS / (1 + queueLength * themeChatStreamTokens.adaptiveDelayQueueScale);
  return Math.max(MIN_CHAR_DELAY_MS, accelerated);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function textLength(text: string): number {
  return getCodePointLength(text);
}

export function canAnimateChatStreamContent(content: string): boolean {
  return content.length <= MAX_CHAT_STREAM_ANIMATION_CHARS;
}

function createRevealedStreamBlock(content: string, key: string, renderNow: number): ChatStreamBlock {
  return {
    births: [],
    charDelay: BASE_CHAR_DELAY_MS,
    codeBlockIndexOffset: 0,
    content,
    imageIndexOffset: 0,
    key,
    nowMs: renderNow,
    revealed: true,
  };
}

function scanStableMarkdownSplit(
  content: string,
  startState?: StableMarkdownScanState | null,
): StableMarkdownScanState {
  const normalizedContent = content.replace(/\r\n?/g, '\n');
  const canResume =
    !!startState &&
    normalizedContent.startsWith(startState.content.slice(0, startState.resumeLineStart));
  let activeFence = canResume ? startState.activeFence : null;
  let splitIndex = canResume ? startState.splitIndex : 0;
  let charOffset = canResume ? startState.charOffset : 0;
  let offset = canResume ? startState.offset : 0;
  let lineStart = canResume ? startState.resumeLineStart : 0;

  while (lineStart < normalizedContent.length) {
    const stateBeforeLine = {
      activeFence,
      charOffset,
      offset,
      splitIndex,
    };
    const newlineIndex = normalizedContent.indexOf('\n', lineStart);
    if (newlineIndex === -1) {
      return {
        ...stateBeforeLine,
        content: normalizedContent,
        resumeLineStart: lineStart,
      };
    }

    const lineEnd = newlineIndex === -1 ? normalizedContent.length : newlineIndex;
    const line = normalizedContent.slice(lineStart, lineEnd);
    if (activeFence) {
      if (isMarkdownFenceClose(line, activeFence)) {
        activeFence = null;
      }
    } else {
      activeFence = getMarkdownFenceState(line);
    }

    offset = lineEnd;
    charOffset += textLength(line);
    if (newlineIndex !== -1) {
      offset += 1;
      charOffset += 1;
    }

    if (activeFence || line.trim()) {
      continue;
    }

    if (offset >= content.length) {
      continue;
    }

    if (charOffset >= MIN_STABLE_PREFIX_CHARS) {
      splitIndex = offset;
    }

    lineStart = newlineIndex + 1;
  }

  return {
    activeFence,
    charOffset,
    content: normalizedContent,
    offset,
    resumeLineStart: lineStart,
    splitIndex,
  };
}

export function buildChatStreamSchedule(
  content: string,
  contentWidth: number,
  startMs: number,
  renderNow: number = startMs,
): ChatStreamBlock {
  if (!canAnimateChatStreamContent(content)) {
    return createRevealedStreamBlock(content, 'stream', renderNow);
  }

  const scheduleWidth = contentWidth > 0 ? contentWidth : FALLBACK_CONTENT_WIDTH;
  const parsedBlocks = parseMarkdownMeasurementBlocks(content);
  const blocks = parsedBlocks.some((block) => block.kind === 'text')
    ? parsedBlocks
    : [{
        kind: 'text' as const,
        extraHeight: 0,
        lineHeight: themeTypographyTokens.streamFallbackLineHeight,
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
      const charCount = textLength(lineText);
      const lineDelay = computeCharDelay(Math.max(0, lineCount - lineIndex - 1));

      for (let charIndex = 0; charIndex < charCount; charIndex += 1) {
        births.push(cursor + charIndex * lineDelay);
      }

      if (charCount > 0) {
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
  const initializedRef = useRef(false);
  const previousContentRef = useRef('');
  const previousContentLengthRef = useRef(0);
  const previousArrivalTimeRef = useRef(renderNow);
  const birthsRef = useRef<number[]>([]);
  const charDelayRef = useRef(0);
  const stableBlockRef = useRef<StableStreamBlockCache | null>(null);
  const stableScanRef = useRef<StableMarkdownScanState | null>(null);

  return useMemo(() => {
    if (!enabled || !canAnimateChatStreamContent(content)) {
      initializedRef.current = false;
      previousContentRef.current = content;
      previousContentLengthRef.current = 0;
      birthsRef.current = [];
      charDelayRef.current = 0;
      stableBlockRef.current = null;
      stableScanRef.current = null;
      return content ? [createRevealedStreamBlock(content, 'static', renderNow)] : [];
    }

    if (!initializedRef.current) {
      initializedRef.current = true;
      previousContentRef.current = content;
      previousContentLengthRef.current = textLength(content);
      previousArrivalTimeRef.current = renderNow;
      birthsRef.current = createFilledCodePointTimings(content, renderNow - CHAT_STREAM_FADE_MS);
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
        birthsRef.current = createFilledCodePointTimings(content, renderNow - CHAT_STREAM_FADE_MS);
        charDelayRef.current = 0;
        previousContentLengthRef.current = textLength(content);
      }

      previousContentRef.current = content;
      previousArrivalTimeRef.current = renderNow;
    }

    const lastBirth = birthsRef.current.at(-1) ?? renderNow;
    const stableScan = scanStableMarkdownSplit(content, stableScanRef.current);
    stableScanRef.current = stableScan;
    const stableSplit = stableScan.splitIndex;
    if (stableSplit > 0) {
      const stableContent = content.slice(0, stableSplit);
      const activeContent = content.slice(stableSplit);
      const stableCharLength = textLength(stableContent);
      const stableKey = `stable:${stableCharLength}`;
      const stableBlock =
        stableBlockRef.current?.block.key === stableKey && stableBlockRef.current.block.content === stableContent
          ? stableBlockRef.current
          : {
              block: {
                births: [],
                charDelay: 0,
                codeBlockIndexOffset: 0,
                content: stableContent,
                imageIndexOffset: 0,
                key: stableKey,
                nowMs: renderNow,
                revealed: true,
              },
              codeBlockIndexOffset: countFencedCodeBlocks(stableContent),
              imageIndexOffset: countRenderableImages(stableContent),
            };
      stableBlockRef.current = stableBlock;

      return [
        stableBlock.block,
        {
          births: birthsRef.current.slice(stableCharLength),
          charDelay: charDelayRef.current,
          codeBlockIndexOffset: stableBlock.codeBlockIndexOffset,
          content: activeContent,
          imageIndexOffset: stableBlock.imageIndexOffset,
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
