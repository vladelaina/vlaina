import { themeCaretOverlayTokens } from '@/styles/themeTokens';

export const CARET_COLOR_VAR = 'var(--vlaina-caret-color)';
export const CARET_WIDTH_VAR = 'var(--vlaina-caret-width)';
export const CARET_VISUAL_HEIGHT_RATIO = 1;
export const CARET_MIN_VISUAL_HEIGHT = 18;

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
    @keyframes ${keyframesName} {
      0%, ${themeCaretOverlayTokens.visibleKeyframeEnd} { opacity: ${themeCaretOverlayTokens.opacityVisible}; }
      ${themeCaretOverlayTokens.hiddenKeyframeStart}, 100% { opacity: ${themeCaretOverlayTokens.opacityHidden}; }
    }
  `;
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
