import type { ChangeEvent, MouseEvent, PointerEvent, WheelEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  UI_FONT_SIZE_DEFAULT,
  UI_FONT_SIZE_MAX,
  UI_FONT_SIZE_MIN,
  useUIStore,
} from '@/stores/uiSlice';
import { applyMarkdownFontSize } from '@/lib/markdown/markdownFontSize';
import { themeUiFeedbackTokens } from '@/styles/themeTokens';

const FONT_SIZE_WHEEL_COMMIT_DELAY_MS = 180;

function clampFontSize(fontSize: number): number {
  return Math.max(UI_FONT_SIZE_MIN, Math.min(UI_FONT_SIZE_MAX, Math.round(fontSize)));
}

export function useAppearanceFontSizeControl(onPreviewingChange?: (previewing: boolean) => void) {
  const fontSize = useUIStore((state) => state.fontSize);
  const setFontSize = useUIStore((state) => state.setFontSize);
  const resetFontSize = useUIStore((state) => state.resetFontSize);
  const [isPreviewingFontSize, setIsPreviewingFontSize] = useState(false);
  const [draftFontSize, setDraftFontSize] = useState(fontSize);
  const draftFontSizeRef = useRef(fontSize);
  const previewingFontSizeRef = useRef(false);
  const pendingFontSizeFrameRef = useRef<number | null>(null);
  const pendingFontSizeRef = useRef(fontSize);
  const lastPreviewFontSizeRef = useRef<number | null>(fontSize);
  const pendingFontSizeCommitTimerRef = useRef<number | null>(null);
  const pendingFontSizeCommitRef = useRef(fontSize);

  const displayedFontSize = isPreviewingFontSize ? draftFontSize : fontSize;

  useEffect(() => {
    if (isPreviewingFontSize) return;
    draftFontSizeRef.current = fontSize;
    setDraftFontSize(fontSize);
  }, [fontSize, isPreviewingFontSize]);

  const cancelScheduledFontSizePreview = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (pendingFontSizeFrameRef.current !== null) {
      window.cancelAnimationFrame(pendingFontSizeFrameRef.current);
      pendingFontSizeFrameRef.current = null;
    }
  }, []);

  const flushScheduledFontSizeCommit = useCallback(() => {
    if (pendingFontSizeCommitTimerRef.current === null) return;
    if (typeof window !== 'undefined') {
      window.clearTimeout(pendingFontSizeCommitTimerRef.current);
    }
    pendingFontSizeCommitTimerRef.current = null;
    setFontSize(pendingFontSizeCommitRef.current);
  }, [setFontSize]);

  const cancelScheduledFontSizeCommit = useCallback(() => {
    if (pendingFontSizeCommitTimerRef.current === null) return;
    if (typeof window !== 'undefined') {
      window.clearTimeout(pendingFontSizeCommitTimerRef.current);
    }
    pendingFontSizeCommitTimerRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      cancelScheduledFontSizePreview();
      flushScheduledFontSizeCommit();
    };
  }, [cancelScheduledFontSizePreview, flushScheduledFontSizeCommit]);

  useEffect(() => {
    onPreviewingChange?.(isPreviewingFontSize);
    previewingFontSizeRef.current = isPreviewingFontSize;
  }, [isPreviewingFontSize, onPreviewingChange]);

  useEffect(() => {
    draftFontSizeRef.current = draftFontSize;
  }, [draftFontSize]);

  useEffect(() => {
    if (!isPreviewingFontSize) return;

    const commitPreview = () => {
      if (!previewingFontSizeRef.current) return;
      previewingFontSizeRef.current = false;
      cancelScheduledFontSizePreview();
      applyMarkdownFontSize(draftFontSizeRef.current);
      setIsPreviewingFontSize(false);
      setFontSize(draftFontSizeRef.current);
    };

    window.addEventListener('pointerup', commitPreview, true);
    window.addEventListener('pointercancel', commitPreview, true);
    window.addEventListener('mouseup', commitPreview, true);
    window.addEventListener('blur', commitPreview);
    return () => {
      window.removeEventListener('pointerup', commitPreview, true);
      window.removeEventListener('pointercancel', commitPreview, true);
      window.removeEventListener('mouseup', commitPreview, true);
      window.removeEventListener('blur', commitPreview);
      if (previewingFontSizeRef.current) {
        previewingFontSizeRef.current = false;
        cancelScheduledFontSizePreview();
        applyMarkdownFontSize(draftFontSizeRef.current);
        setFontSize(draftFontSizeRef.current);
      }
      onPreviewingChange?.(false);
    };
  }, [cancelScheduledFontSizePreview, isPreviewingFontSize, onPreviewingChange, setFontSize]);

  const progressPercent = useMemo(() => {
    const bounded = clampFontSize(displayedFontSize);
    return `${((bounded - UI_FONT_SIZE_MIN) / (UI_FONT_SIZE_MAX - UI_FONT_SIZE_MIN)) * 100}%`;
  }, [displayedFontSize]);

  const scheduleFontSizePreview = useCallback((next: number, force = false) => {
    pendingFontSizeRef.current = next;
    if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
      applyMarkdownFontSize(next);
      return;
    }

    if (pendingFontSizeFrameRef.current !== null) return;
    pendingFontSizeFrameRef.current = window.requestAnimationFrame(() => {
      pendingFontSizeFrameRef.current = null;
      const pending = pendingFontSizeRef.current;
      if (
        !force &&
        lastPreviewFontSizeRef.current !== null &&
        Math.abs(pending - lastPreviewFontSizeRef.current) <
        themeUiFeedbackTokens.markdownFontSizePreviewStepPx
      ) {
        return;
      }
      lastPreviewFontSizeRef.current = pending;
      applyMarkdownFontSize(pending);
    });
  }, []);

  const scheduleFontSizeCommit = useCallback((next: number) => {
    pendingFontSizeCommitRef.current = next;
    if (typeof window === 'undefined' || typeof window.setTimeout !== 'function') {
      setFontSize(next);
      return;
    }

    if (pendingFontSizeCommitTimerRef.current !== null) {
      window.clearTimeout(pendingFontSizeCommitTimerRef.current);
    }
    pendingFontSizeCommitTimerRef.current = window.setTimeout(() => {
      pendingFontSizeCommitTimerRef.current = null;
      setFontSize(pendingFontSizeCommitRef.current);
    }, FONT_SIZE_WHEEL_COMMIT_DELAY_MS);
  }, [setFontSize]);

  const handleFontSizeChange = (e: ChangeEvent<HTMLInputElement>) => {
    const next = parseInt(e.target.value);
    if (draftFontSizeRef.current === next) return;
    cancelScheduledFontSizeCommit();
    draftFontSizeRef.current = next;
    setDraftFontSize(next);
    if (previewingFontSizeRef.current) {
      scheduleFontSizePreview(next);
    } else {
      setFontSize(next);
    }
  };

  const handleFontSizeWheel = (event: WheelEvent<HTMLInputElement>) => {
    if (event.deltaY === 0) return;

    event.preventDefault();
    event.stopPropagation();
    cancelScheduledFontSizePreview();

    if (previewingFontSizeRef.current) {
      previewingFontSizeRef.current = false;
      setIsPreviewingFontSize(false);
    }

    const current = draftFontSizeRef.current;
    const next = clampFontSize(current + (event.deltaY < 0 ? 1 : -1));
    if (next === current) return;

    draftFontSizeRef.current = next;
    setDraftFontSize(next);
    scheduleFontSizePreview(next, true);
    scheduleFontSizeCommit(next);
  };

  const beginFontSizePreview = (event: PointerEvent<HTMLInputElement> | MouseEvent<HTMLInputElement>) => {
    if ('button' in event && event.button !== 0) return;
    if (previewingFontSizeRef.current) return;
    cancelScheduledFontSizeCommit();
    draftFontSizeRef.current = fontSize;
    lastPreviewFontSizeRef.current = null;
    setDraftFontSize(fontSize);
    previewingFontSizeRef.current = true;
    setIsPreviewingFontSize(true);
  };

  const handleResetFontSize = () => {
    cancelScheduledFontSizePreview();
    cancelScheduledFontSizeCommit();
    draftFontSizeRef.current = UI_FONT_SIZE_DEFAULT;
    setDraftFontSize(UI_FONT_SIZE_DEFAULT);
    resetFontSize();
  };

  return {
    committedFontSize: fontSize,
    displayedFontSize,
    isPreviewingFontSize,
    progressPercent,
    handleFontSizeChange,
    handleFontSizeWheel,
    beginFontSizePreview,
    handleResetFontSize,
  };
}
