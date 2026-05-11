import { useEffect, useMemo, useRef, useState } from 'react';
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
const CLOCK_TICK_MS = 48;
const FALLBACK_CONTENT_WIDTH = 640;

export interface ChatStreamBlock {
  births: number[];
  charDelay: number;
  content: string;
  key: string;
  nowMs: number;
  revealed: boolean;
}

function now(): number {
  return typeof performance === 'undefined' ? Date.now() : performance.now();
}

function resolveStreamStartMs(streamStartTime?: Date): number | null {
  const streamStartTimestamp = streamStartTime?.getTime();
  if (streamStartTimestamp == null || !Number.isFinite(streamStartTimestamp)) {
    return null;
  }

  const elapsedWallTime = Math.max(0, Date.now() - streamStartTimestamp);
  return now() - elapsedWallTime;
}

function computeCharDelay(queueLength: number): number {
  const accelerated = BASE_CHAR_DELAY_MS / (1 + queueLength * 0.3);
  return Math.max(MIN_CHAR_DELAY_MS, accelerated);
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
    content,
    key: 'stream',
    nowMs: renderNow,
    revealed: births.length === 0 || renderNow - (births.at(-1) ?? renderNow) >= CHAT_STREAM_FADE_MS,
  };
}

export function useChatStreamBlocks(
  content: string,
  enabled: boolean,
  contentWidth: number = 0,
  streamStartTime?: Date,
  suspendClock: boolean = false,
  pauseClockRef?: { readonly current: boolean },
): ChatStreamBlock[] {
  const [renderNow, setRenderNow] = useState(() => now());
  const fallbackStartMsRef = useRef<number | null>(null);
  const resolvedStartMsRef = useRef<{ timestamp: number; startMs: number } | null>(null);
  if (fallbackStartMsRef.current === null) {
    fallbackStartMsRef.current = now();
  }

  const streamStartTimestamp = streamStartTime?.getTime();
  if (streamStartTimestamp != null && Number.isFinite(streamStartTimestamp)) {
    if (resolvedStartMsRef.current?.timestamp !== streamStartTimestamp) {
      resolvedStartMsRef.current = {
        timestamp: streamStartTimestamp,
        startMs: resolveStreamStartMs(streamStartTime) ?? fallbackStartMsRef.current,
      };
    }
  } else {
    resolvedStartMsRef.current = null;
  }

  const resolvedStartMs = resolvedStartMsRef.current?.startMs ?? null;
  const startMs = resolvedStartMs ?? fallbackStartMsRef.current;

  useEffect(() => {
    if (!enabled || suspendClock) {
      return;
    }

    const intervalId = window.setInterval(() => {
      if (pauseClockRef?.current) {
        return;
      }
      setRenderNow(now());
    }, CLOCK_TICK_MS);
    return () => window.clearInterval(intervalId);
  }, [enabled, pauseClockRef, suspendClock]);

  return useMemo(() => {
    if (!enabled) {
      const blocks = content ? [{
        births: [],
        charDelay: BASE_CHAR_DELAY_MS,
        content,
        key: 'static',
        nowMs: renderNow,
        revealed: true,
      }] : [];
      return blocks;
    }

    const schedule = buildChatStreamSchedule(content, contentWidth, startMs, renderNow);
    return [{
      ...schedule,
      nowMs: renderNow,
    }];
  }, [content, contentWidth, enabled, renderNow, startMs]);
}
