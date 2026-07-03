import { useMemo, useRef } from 'react';
import { countFencedCodeBlocks, countRenderableImages } from './chatStreamTextMetadata';
import { themeChatStreamTokens } from '@/styles/themeTokens';
import { CHAT_STREAM_FADE_MS } from './chatStreamTextPlugin';
import {
  canAnimateChatStreamContent,
  capUnrevealedBirths,
  createFilledCodePointTimings,
  createRevealedStreamBlock,
  revealPriorBirths,
  scanStableMarkdownSplit,
  textLength,
  type ChatStreamBlock,
  type StableMarkdownScanState,
} from './chatStreamTextSchedule';

const MIN_ADAPTIVE_CHAR_DELAY_MS = themeChatStreamTokens.minAdaptiveCharDelayMs;
const MAX_ADAPTIVE_CHAR_DELAY_MS = themeChatStreamTokens.maxAdaptiveCharDelayMs;
const MIN_APPEND_WINDOW_MS = themeChatStreamTokens.minAppendWindowMs;
const MAX_APPEND_WINDOW_MS = themeChatStreamTokens.maxAppendWindowMs;
const APPEND_WINDOW_RATIO = themeChatStreamTokens.appendWindowRatio;

interface StableStreamBlockCache {
  block: ChatStreamBlock;
  codeBlockIndexOffset: number;
  imageIndexOffset: number;
}

function now(): number {
  return typeof performance === 'undefined' ? Date.now() : performance.now();
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
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

        revealPriorBirths(birthsRef.current, previousLength, renderNow);
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

    capUnrevealedBirths(birthsRef.current, renderNow);
    const lastBirth = birthsRef.current.at(-1) ?? renderNow;
    const animationNow = previousArrivalTimeRef.current;
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
                nowMs: animationNow,
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
          nowMs: animationNow,
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
      nowMs: animationNow,
      revealed: birthsRef.current.length === 0 || renderNow - lastBirth >= CHAT_STREAM_FADE_MS,
    }];
  }, [content, enabled, renderNow]);
}

export {
  buildChatStreamSchedule,
  canAnimateChatStreamContent,
  MAX_CHAT_STREAM_ANIMATION_CHARS,
  MAX_UNREVEALED_CHAT_STREAM_CHARS,
} from './chatStreamTextSchedule';
export type { ChatStreamBlock } from './chatStreamTextSchedule';
