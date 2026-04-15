import { useLayoutEffect } from 'react';
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
): void {
  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    const applyHeight = () => {
      const current = textareaRef.current;
      if (!current) {
        return;
      }

      const width = current.clientWidth;
      if (width <= 0) {
        applyFallbackHeight(current, minHeight, maxHeight);
        return;
      }

      try {
        const metrics = resolveElementTextLayoutMetrics(current);
        const nextHeight = measureTextareaContentHeight(value, width, {
          font: metrics.font,
          lineHeight: metrics.lineHeight,
          minHeight,
          maxHeight,
        });
        current.style.height = `${nextHeight}px`;
      } catch {
        applyFallbackHeight(current, minHeight, maxHeight);
      }
    };

    applyHeight();

    const resizeObserver = new ResizeObserver(() => {
      applyHeight();
    });
    resizeObserver.observe(textarea);

    return () => {
      resizeObserver.disconnect();
    };
  }, [maxHeight, minHeight, textareaRef, value]);
}
