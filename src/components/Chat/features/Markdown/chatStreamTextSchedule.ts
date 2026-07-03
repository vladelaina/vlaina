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
import { MARKDOWN_BLOCK_GAP } from '@/components/common/markdown/markdownMetrics';
import { themeChatStreamTokens, themeTypographyTokens } from '@/styles/themeTokens';
import { createFilledCodePointTimings, getCodePointLength } from './chatStreamTextMetrics';
import { CHAT_STREAM_FADE_MS } from './chatStreamTextPlugin';

const BASE_CHAR_DELAY_MS = themeChatStreamTokens.baseCharDelayMs;
const MIN_CHAR_DELAY_MS = themeChatStreamTokens.minCharDelayMs;
const FALLBACK_CONTENT_WIDTH = themeChatStreamTokens.fallbackContentWidthPx;
const MIN_STABLE_PREFIX_CHARS = themeChatStreamTokens.minStablePrefixChars;

export const MAX_CHAT_STREAM_ANIMATION_CHARS = 20_000;
export const MAX_UNREVEALED_CHAT_STREAM_CHARS = 120;

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

export interface StableMarkdownScanState {
  activeFence: MarkdownFenceState | null;
  charOffset: number;
  content: string;
  offset: number;
  resumeLineStart: number;
  splitIndex: number;
}

export function textLength(text: string): number {
  return getCodePointLength(text);
}

export function canAnimateChatStreamContent(content: string): boolean {
  return content.length <= MAX_CHAT_STREAM_ANIMATION_CHARS;
}

export function createRevealedStreamBlock(content: string, key: string, renderNow: number): ChatStreamBlock {
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

export function capUnrevealedBirths(births: number[], renderNow: number): void {
  let unrevealedCount = 0;
  for (let index = births.length - 1; index >= 0; index -= 1) {
    const birth = births[index] ?? renderNow;
    if (renderNow - birth >= CHAT_STREAM_FADE_MS) {
      continue;
    }

    unrevealedCount += 1;
    if (unrevealedCount > MAX_UNREVEALED_CHAT_STREAM_CHARS) {
      births[index] = renderNow - CHAT_STREAM_FADE_MS;
    }
  }
}

export function revealPriorBirths(births: number[], length: number, renderNow: number): void {
  const revealedBirth = renderNow - CHAT_STREAM_FADE_MS;
  for (let index = 0; index < length; index += 1) {
    if ((births[index] ?? revealedBirth) > revealedBirth) {
      births[index] = revealedBirth;
    }
  }
}

export function scanStableMarkdownSplit(
  content: string,
  startState?: StableMarkdownScanState | null,
): StableMarkdownScanState {
  const canResume =
    !!startState &&
    content.startsWith(startState.content.slice(0, startState.resumeLineStart));
  let activeFence = canResume ? startState.activeFence : null;
  let splitIndex = canResume ? startState.splitIndex : 0;
  let charOffset = canResume ? startState.charOffset : 0;
  let offset = canResume ? startState.offset : 0;
  let lineStart = canResume ? startState.resumeLineStart : 0;

  while (lineStart < content.length) {
    const stateBeforeLine = {
      activeFence,
      charOffset,
      offset,
      splitIndex,
    };
    const newlineIndex = content.indexOf('\n', lineStart);
    if (newlineIndex === -1) {
      return {
        ...stateBeforeLine,
        content,
        resumeLineStart: lineStart,
      };
    }

    const lineEnd = newlineIndex === -1 ? content.length : newlineIndex;
    const rawLine = content.slice(lineStart, lineEnd);
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
    if (activeFence) {
      if (isMarkdownFenceClose(line, activeFence)) {
        activeFence = null;
      }
    } else {
      activeFence = getMarkdownFenceState(line);
    }

    offset = lineEnd;
    charOffset += textLength(rawLine);
    if (newlineIndex !== -1) {
      offset += 1;
      charOffset += 1;
    }

    if (!activeFence && !line.trim() && offset < content.length && charOffset >= MIN_STABLE_PREFIX_CHARS) {
      splitIndex = offset;
    }

    lineStart = newlineIndex + 1;
  }

  return {
    activeFence,
    charOffset,
    content,
    offset,
    resumeLineStart: lineStart,
    splitIndex,
  };
}

function computeCharDelay(queueLength: number): number {
  const accelerated = BASE_CHAR_DELAY_MS / (1 + queueLength * themeChatStreamTokens.adaptiveDelayQueueScale);
  return Math.max(MIN_CHAR_DELAY_MS, accelerated);
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

export { createFilledCodePointTimings };
