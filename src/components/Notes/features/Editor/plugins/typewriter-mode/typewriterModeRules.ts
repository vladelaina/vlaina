interface RectLike {
  top: number;
  bottom: number;
}

interface ScrollTargetMetrics {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
  rootRect: RectLike;
  cursorRect: RectLike;
}

export const TYPEWRITER_SCROLL_TOP_TOLERANCE_PX = 1;

export function resolveTypewriterScrollTop({
  scrollTop,
  scrollHeight,
  clientHeight,
  rootRect,
  cursorRect,
}: ScrollTargetMetrics): number {
  const cursorCenter = (cursorRect.top + cursorRect.bottom) / 2;
  const rootCenter = (rootRect.top + rootRect.bottom) / 2;
  const maxScrollTop = Math.max(0, scrollHeight - clientHeight);
  return Math.max(0, Math.min(maxScrollTop, scrollTop + cursorCenter - rootCenter));
}

export function shouldUpdateTypewriterScrollTop(
  currentScrollTop: number,
  nextScrollTop: number,
  tolerancePx = TYPEWRITER_SCROLL_TOP_TOLERANCE_PX
): boolean {
  return Math.abs(nextScrollTop - currentScrollTop) > tolerancePx;
}

export function shouldCenterTypewriterSelection(selection: { empty: boolean }): boolean {
  return selection.empty;
}

export function isTypewriterInputEvent(event: InputEvent): boolean {
  return event.inputType.startsWith('insert') || event.inputType.startsWith('delete');
}

export function isTypewriterKeyEvent(event: KeyboardEvent): boolean {
  if (event.isComposing) return false;

  if (event.key === 'Enter' || event.key === 'Backspace' || event.key === 'Delete' || event.key === 'Tab') {
    return true;
  }

  if ((!event.metaKey && !event.ctrlKey) || event.altKey) {
    return false;
  }

  const key = event.key.toLowerCase();
  return key === 'z' || key === 'y';
}
