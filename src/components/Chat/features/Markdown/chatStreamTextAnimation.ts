import { useEffect, useMemo, useRef, useState } from 'react';
import { CHAT_STREAM_FADE_MS } from './chatStreamTextPlugin';

const BASE_CHAR_DELAY_MS = 18;
const QUEUE_ACCELERATION = 0.3;
const MAX_BLOCK_REVEAL_MS = 3000;
const CLOCK_TICK_MS = 48;

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

function countChars(text: string): number {
  return Array.from(text).length;
}

function splitMarkdownBlocks(content: string): Array<{ content: string; startOffset: number }> {
  if (!content) {
    return [];
  }

  const blocks: Array<{ content: string; startOffset: number }> = [];
  let blockStart = 0;
  let cursor = 0;
  let inFence = false;
  let currentKind: 'blank' | 'code' | 'heading' | 'list' | 'paragraph' | 'table' = 'blank';

  const kindForLine = (line: string) => {
    const trimmed = line.trimStart();
    if (/^\s*$/.test(line)) {
      return 'blank' as const;
    }
    if (inFence || trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
      return 'code' as const;
    }
    if (/^#{1,6}\s/.test(trimmed)) {
      return 'heading' as const;
    }
    if (/^([-*+]|\d+[.)])\s+/.test(trimmed)) {
      return 'list' as const;
    }
    if (trimmed.includes('|')) {
      return 'table' as const;
    }
    return 'paragraph' as const;
  };

  const pushBlock = (endOffset: number) => {
    if (endOffset > blockStart) {
      blocks.push({ content: content.slice(blockStart, endOffset), startOffset: blockStart });
    }
    blockStart = endOffset;
  };

  for (const line of content.matchAll(/.*(?:\n|$)/g)) {
    const value = line[0];
    if (!value) {
      break;
    }

    const nextKind = kindForLine(value);
    if (
      currentKind !== 'blank' &&
      nextKind !== 'blank' &&
      nextKind !== currentKind &&
      currentKind !== 'code' &&
      nextKind !== 'code'
    ) {
      pushBlock(cursor);
      currentKind = nextKind;
    } else if (currentKind === 'blank' && nextKind !== 'blank') {
      currentKind = nextKind;
    }

    const trimmed = value.trimStart();
    if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
      inFence = !inFence;
    }

    cursor += value.length;

    if (!inFence && nextKind === 'blank') {
      pushBlock(cursor);
      currentKind = 'blank';
    } else if (!inFence && nextKind === 'heading') {
      pushBlock(cursor);
      currentKind = 'blank';
    }
  }

  if (blockStart < content.length) {
    pushBlock(content.length);
  }

  return blocks.filter((block) => block.content.length > 0);
}

function computeCharDelay(queueLength: number, charCount: number): number {
  const accelerated = BASE_CHAR_DELAY_MS / (1 + queueLength * QUEUE_ACCELERATION);
  return Math.min(accelerated, MAX_BLOCK_REVEAL_MS / Math.max(charCount, 1));
}

function getBlockState(index: number, revealedCount: number, tailIndex: number) {
  if (index < revealedCount) {
    return 'revealed';
  }

  if (index === revealedCount && index < tailIndex) {
    return 'animating';
  }

  if (index === revealedCount && index === tailIndex) {
    return 'streaming';
  }

  return 'queued';
}

export function useChatStreamBlocks(content: string, enabled: boolean): ChatStreamBlock[] {
  const blocks = useMemo(() => splitMarkdownBlocks(content), [content]);
  const [revealedCount, setRevealedCount] = useState(0);
  const [renderNow, setRenderNow] = useState(() => now());
  const previousBlockCountRef = useRef(0);
  const minRevealedRef = useRef(0);
  const birthsRef = useRef(new Map<number, number[]>());
  const delayRef = useRef(new Map<number, number>());

  if (blocks.length === 0 && previousBlockCountRef.current !== 0) {
    minRevealedRef.current = 0;
  }

  if (blocks.length > previousBlockCountRef.current && previousBlockCountRef.current > 0) {
    minRevealedRef.current = Math.max(minRevealedRef.current, previousBlockCountRef.current);
  }

  previousBlockCountRef.current = blocks.length;

  useEffect(() => {
    if (!enabled) {
      birthsRef.current.clear();
      delayRef.current.clear();
      return;
    }

    if (blocks.length === 0) {
      setRevealedCount(0);
      minRevealedRef.current = 0;
    }
  }, [blocks.length, enabled]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const intervalId = window.setInterval(() => setRenderNow(now()), CLOCK_TICK_MS);
    return () => window.clearInterval(intervalId);
  }, [enabled]);

  const effectiveRevealedCount = Math.max(revealedCount, minRevealedRef.current);
  const tailIndex = blocks.length - 1;
  const animatingIndex = effectiveRevealedCount < tailIndex ? effectiveRevealedCount : -1;
  const queueLength = Math.max(0, tailIndex - effectiveRevealedCount - 1);
  const activeIndex = animatingIndex >= 0 ? animatingIndex : tailIndex >= effectiveRevealedCount ? tailIndex : -1;
  const activeCharCount = activeIndex >= 0 ? countChars(blocks[activeIndex]?.content ?? '') : 0;
  const activeDelay = activeIndex >= 0 ? computeCharDelay(queueLength, activeCharCount) : BASE_CHAR_DELAY_MS;

  const visibleBlocks = useMemo(() => {
    if (!enabled) {
      return blocks.map((block) => ({
        births: [],
        charDelay: BASE_CHAR_DELAY_MS,
        content: block.content,
        key: String(block.startOffset),
        nowMs: renderNow,
        revealed: true,
      }));
    }

    const nextBirths = new Map<number, number[]>();
    const visibleBlocks: ChatStreamBlock[] = [];

    blocks.forEach((block, index) => {
      const state = getBlockState(index, effectiveRevealedCount, tailIndex);
      if (state === 'queued') {
        return;
      }

      const charCount = countChars(block.content);
      const previous = birthsRef.current.get(block.startOffset);
      let births = previous?.slice(0, charCount) ?? [];

      if (births.length < charCount) {
        const delay = state === 'revealed'
          ? delayRef.current.get(block.startOffset) ?? activeDelay
          : activeDelay;
        const cap = renderNow + CHAT_STREAM_FADE_MS;

        for (let charIndex = births.length; charIndex < charCount; charIndex += 1) {
          const previousBirth = charIndex > 0 ? births[charIndex - 1] : renderNow - delay;
          births.push(Math.min(cap, Math.max(renderNow, previousBirth + delay)));
        }
      }

      const charDelay = state === 'revealed'
        ? delayRef.current.get(block.startOffset) ?? activeDelay
        : activeDelay;
      const lastBirth = births.at(-1) ?? renderNow;

      nextBirths.set(block.startOffset, births);
      delayRef.current.set(block.startOffset, charDelay);
      visibleBlocks.push({
        births,
        charDelay,
        content: block.content,
        key: String(block.startOffset),
        nowMs: renderNow,
        revealed: state === 'revealed' && renderNow - lastBirth >= CHAT_STREAM_FADE_MS,
      });
    });

    birthsRef.current = nextBirths;
    return visibleBlocks;
  }, [activeDelay, blocks, effectiveRevealedCount, enabled, renderNow, tailIndex]);

  useEffect(() => {
    if (!enabled || animatingIndex < 0) {
      return;
    }

    const charCount = countChars(blocks[animatingIndex]?.content ?? '');
    const timeoutMs = Math.max(0, (charCount - 1) * activeDelay) + CHAT_STREAM_FADE_MS;
    const timeoutId = window.setTimeout(() => {
      setRevealedCount(effectiveRevealedCount + 1);
    }, timeoutMs);

    return () => window.clearTimeout(timeoutId);
  }, [activeDelay, animatingIndex, blocks, effectiveRevealedCount, enabled]);

  return visibleBlocks;
}
