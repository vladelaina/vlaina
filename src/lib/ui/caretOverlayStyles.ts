import { themeCaretOverlayTokens } from '@/styles/themeTokens';

export const CARET_COLOR_VAR = 'var(--vlaina-caret-color)';
export const CARET_WIDTH_VAR = 'var(--vlaina-caret-width)';
export const CARET_VISUAL_HEIGHT_RATIO = 1;
export const CARET_MIN_VISUAL_HEIGHT = 18;
export const CARET_BLINK_HELD_ATTR = 'data-caret-blink-held';
export const CARET_BLINK_HOLD_DELAY_MS = themeCaretOverlayTokens.blinkHoldDelayMs;

const CARET_NAVIGATION_KEYS = new Set([
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'End',
  'Home',
  'PageDown',
  'PageUp',
]);

const caretBlinkHoldTimers = new WeakMap<HTMLElement, number>();

interface CaretOverlayLineRect {
  left: number;
  top: number;
  bottom: number;
}

interface CaretOverlayRect {
  left: number;
  top: number;
  height: number;
}

interface CaretOverlayStyleOptions {
  activeSelector?: string;
  caretClass: string;
  keyframesName: string;
}

export function createCaretOverlayStyle({
  activeSelector,
  caretClass,
  keyframesName,
}: CaretOverlayStyleOptions): string {
  return `
    ${activeSelector ? `${activeSelector} {\n      caret-color: transparent !important;\n    }` : ''}
    .${caretClass} {
      position: fixed;
      width: ${CARET_WIDTH_VAR};
      background: ${CARET_COLOR_VAR};
      pointer-events: none;
      z-index: ${themeCaretOverlayTokens.zIndex};
      animation: ${keyframesName} ${themeCaretOverlayTokens.blinkDuration} steps(2, start) infinite;
    }
    .${caretClass}[${CARET_BLINK_HELD_ATTR}='true'] {
      animation: none !important;
      opacity: ${themeCaretOverlayTokens.opacityVisible} !important;
    }
    @keyframes ${keyframesName} {
      0%, ${themeCaretOverlayTokens.visibleKeyframeEnd} { opacity: ${themeCaretOverlayTokens.opacityVisible}; }
      ${themeCaretOverlayTokens.hiddenKeyframeStart}, 100% { opacity: ${themeCaretOverlayTokens.opacityHidden}; }
    }
  `;
}

export function isCaretNavigationKey(event: Pick<KeyboardEvent, 'key'>): boolean {
  return CARET_NAVIGATION_KEYS.has(event.key);
}

export function holdCaretBlink(element: HTMLElement | null, delayMs: number | null = CARET_BLINK_HOLD_DELAY_MS): void {
  if (!element) return;

  const ownerWindow = element.ownerDocument.defaultView;
  if (!ownerWindow) return;

  const existingTimer = caretBlinkHoldTimers.get(element);
  if (existingTimer !== undefined) {
    ownerWindow.clearTimeout(existingTimer);
  }

  element.setAttribute(CARET_BLINK_HELD_ATTR, 'true');
  if (delayMs === null) {
    return;
  }

  const timer = ownerWindow.setTimeout(() => {
    element.removeAttribute(CARET_BLINK_HELD_ATTR);
    caretBlinkHoldTimers.delete(element);
  }, delayMs);
  caretBlinkHoldTimers.set(element, timer);
}

export function releaseCaretBlink(element: HTMLElement | null): void {
  if (!element) return;

  const existingTimer = caretBlinkHoldTimers.get(element);
  if (existingTimer !== undefined) {
    element.ownerDocument.defaultView?.clearTimeout(existingTimer);
    caretBlinkHoldTimers.delete(element);
  }
  element.removeAttribute(CARET_BLINK_HELD_ATTR);
}

export function createCaretOverlayRect(lineRect: CaretOverlayLineRect): CaretOverlayRect {
  const lineHeight = Math.max(0, lineRect.bottom - lineRect.top);
  if (!Number.isFinite(lineHeight) || lineHeight <= 0) {
    return {
      left: lineRect.left,
      top: lineRect.top,
      height: CARET_MIN_VISUAL_HEIGHT,
    };
  }

  const height = Math.max(CARET_MIN_VISUAL_HEIGHT, lineHeight * CARET_VISUAL_HEIGHT_RATIO);

  return {
    left: lineRect.left,
    top: lineRect.top + (lineHeight - height) / 2,
    height,
  };
}
