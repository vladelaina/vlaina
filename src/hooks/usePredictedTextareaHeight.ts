import { useEffect, useLayoutEffect, useRef } from 'react';
import type { RefObject } from 'react';
import {
  measureTextareaContentHeight,
  resolveElementTextLayoutMetrics,
} from '@/lib/text-layout';

interface UsePredictedTextareaHeightOptions {
  maxHeight: number;
  minHeight: number;
  value: string;
}

export interface TextareaHeightController {
  syncHeight: (value?: string) => void;
}

function applyFallbackHeight(
  textarea: HTMLTextAreaElement,
  minHeight: number,
  maxHeight: number,
): void {
  textarea.style.height = 'auto';
  const nextHeight = Math.max(minHeight, Math.min(textarea.scrollHeight, maxHeight));
  textarea.style.height = `${nextHeight}px`;
}

export function usePredictedTextareaHeight(
  textareaRef: RefObject<HTMLTextAreaElement | null>,
  { maxHeight, minHeight, value }: UsePredictedTextareaHeightOptions,
): TextareaHeightController {
  const latestOptionsRef = useRef({ maxHeight, minHeight, value });
  const applyHeightRef = useRef<(value?: string) => void>(() => {});
  const observerRef = useRef<ResizeObserver | null>(null);
  const observedTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  useLayoutEffect(() => {
    latestOptionsRef.current = { maxHeight, minHeight, value };

    const applyHeight = (overrideValue?: string) => {
      const current = textareaRef.current;
      if (!current) {
        return;
      }

      const {
        maxHeight: nextMaxHeight,
        minHeight: nextMinHeight,
        value: measuredValue,
      } = latestOptionsRef.current;
      const nextValue = overrideValue ?? measuredValue;

      if (nextMaxHeight <= 0) {
        return;
      }

      const width = current.clientWidth;
      if (width <= 0) {
        applyFallbackHeight(current, nextMinHeight, nextMaxHeight);
        return;
      }

      try {
        const metrics = resolveElementTextLayoutMetrics(current);
        const nextHeight = measureTextareaContentHeight(nextValue, width, {
          font: metrics.font,
          lineHeight: metrics.lineHeight,
          minHeight: Math.max(0, nextMinHeight - metrics.paddingBlock),
          maxHeight: Math.max(0, nextMaxHeight - metrics.paddingBlock),
        });
        current.style.height = `${nextHeight + metrics.paddingBlock}px`;
      } catch {
        applyFallbackHeight(current, nextMinHeight, nextMaxHeight);
      }
    };

    applyHeightRef.current = applyHeight;
    applyHeight();

    const textarea = textareaRef.current;
    if (
      !textarea ||
      observedTextareaRef.current === textarea ||
      typeof ResizeObserver === 'undefined'
    ) {
      return;
    }

    observerRef.current?.disconnect();
    const resizeObserver = new ResizeObserver(() => {
      applyHeightRef.current();
    });
    resizeObserver.observe(textarea);
    observerRef.current = resizeObserver;
    observedTextareaRef.current = textarea;
  }, [maxHeight, minHeight, textareaRef, value]);

  useEffect(() => {
    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
      observedTextareaRef.current = null;
    };
  }, []);

  return {
    syncHeight: (nextValue) => applyHeightRef.current(nextValue),
  };
}
