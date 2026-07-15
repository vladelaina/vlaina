import { useEffect, type RefObject } from 'react';

interface CaretLayoutRect {
  height: number;
  left: number;
  top: number;
}

interface UseChatInputCaretLayoutSyncOptions {
  composerRootRef: RefObject<HTMLElement | null>;
  isComposing: boolean;
  scheduleComposerRefocus: (position?: number) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
}

const LAYOUT_CHANGE_EPSILON_PX = 0.5;

function measureCaretLayout(element: HTMLElement): CaretLayoutRect {
  const rect = element.getBoundingClientRect();
  return {
    height: rect.height,
    left: rect.left,
    top: rect.top,
  };
}

export function shouldRefocusMovedCaret(
  previous: CaretLayoutRect,
  current: CaretLayoutRect,
  textareaActive: boolean,
  isComposing: boolean,
): boolean {
  if (!textareaActive || isComposing) {
    return false;
  }

  const textareaResized = Math.abs(current.height - previous.height) > LAYOUT_CHANGE_EPSILON_PX;
  if (textareaResized) {
    return false;
  }

  return (
    Math.abs(current.top - previous.top) > LAYOUT_CHANGE_EPSILON_PX
    || Math.abs(current.left - previous.left) > LAYOUT_CHANGE_EPSILON_PX
  );
}

export function useChatInputCaretLayoutSync({
  composerRootRef,
  isComposing,
  scheduleComposerRefocus,
  textareaRef,
}: UseChatInputCaretLayoutSyncOptions): void {
  useEffect(() => {
    const composer = composerRootRef.current;
    const textarea = textareaRef.current;
    if (!composer || !textarea || typeof ResizeObserver === 'undefined') {
      return;
    }

    let previous = measureCaretLayout(textarea);
    let frameId: number | null = null;
    const observer = new ResizeObserver(() => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
      frameId = requestAnimationFrame(() => {
        frameId = null;
        const current = measureCaretLayout(textarea);
        const shouldRefocus = shouldRefocusMovedCaret(
          previous,
          current,
          document.activeElement === textarea,
          isComposing,
        );
        previous = current;
        if (shouldRefocus) {
          scheduleComposerRefocus();
        }
      });
    });

    observer.observe(composer);
    observer.observe(textarea);
    if (composer.parentElement) {
      observer.observe(composer.parentElement);
    }
    return () => {
      observer.disconnect();
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [composerRootRef, isComposing, scheduleComposerRefocus, textareaRef]);
}
