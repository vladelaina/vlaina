import { useEffect, useLayoutEffect, useRef } from 'react';
import type { RefObject } from 'react';
import {
  measureTextareaContentHeight,
  resolveElementTextLayoutMetrics,
  type ElementTextLayoutMetrics,
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
  const metricsRef = useRef<{
    element: HTMLTextAreaElement;
    metrics: ElementTextLayoutMetrics;
  } | null>(null);
  const lastAppliedRef = useRef<{
    height: string;
    width: number;
  } | null>(null);
  const retryFrameRef = useRef<number | null>(null);
  const retryTimeoutRef = useRef<number | null>(null);

  const clearPendingRetry = () => {
    if (retryFrameRef.current !== null) {
      cancelAnimationFrame(retryFrameRef.current);
      retryFrameRef.current = null;
    }
    if (retryTimeoutRef.current !== null) {
      window.clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  };

  const scheduleRetry = () => {
    if (retryFrameRef.current !== null || retryTimeoutRef.current !== null) {
      return;
    }

    retryFrameRef.current = requestAnimationFrame(() => {
      retryFrameRef.current = null;
      applyHeightRef.current();
    });
    retryTimeoutRef.current = window.setTimeout(() => {
      retryTimeoutRef.current = null;
      applyHeightRef.current();
    }, 120);
  };

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
        current.style.height = '';
        lastAppliedRef.current = null;
        scheduleRetry();
        return;
      }

      clearPendingRetry();
      try {
        let metrics = metricsRef.current?.element === current
          ? metricsRef.current.metrics
          : null;
        if (!metrics) {
          metrics = resolveElementTextLayoutMetrics(current);
          metricsRef.current = { element: current, metrics };
        }
        const nextHeight = measureTextareaContentHeight(nextValue, width, {
          font: metrics.font,
          lineHeight: metrics.lineHeight,
          minHeight: Math.max(0, nextMinHeight - metrics.paddingBlock),
          maxHeight: Math.max(0, nextMaxHeight - metrics.paddingBlock),
        });
        const nextStyleHeight = `${nextHeight + metrics.paddingBlock}px`;
        if (current.style.height !== nextStyleHeight) {
          current.style.height = nextStyleHeight;
        }
        lastAppliedRef.current = {
          height: nextStyleHeight,
          width,
        };
      } catch {
        applyFallbackHeight(current, nextMinHeight, nextMaxHeight);
        lastAppliedRef.current = {
          height: current.style.height,
          width,
        };
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
      const current = textareaRef.current;
      const lastApplied = lastAppliedRef.current;
      if (
        current &&
        lastApplied &&
        current.clientWidth === lastApplied.width &&
        current.style.height === lastApplied.height
      ) {
        return;
      }
      applyHeightRef.current();
    });
    resizeObserver.observe(textarea);
    observerRef.current = resizeObserver;
    observedTextareaRef.current = textarea;
  }, [maxHeight, minHeight, textareaRef, value]);

  useEffect(() => {
    return () => {
      clearPendingRetry();
      observerRef.current?.disconnect();
      observerRef.current = null;
      observedTextareaRef.current = null;
      metricsRef.current = null;
      lastAppliedRef.current = null;
    };
  }, []);

  return {
    syncHeight: (nextValue) => applyHeightRef.current(nextValue),
  };
}
