import { useEffect } from 'react';
import { createCaretOverlayRect, createCaretOverlayStyle } from '@/lib/ui/caretOverlayStyles';

const STYLE_ID = 'vlaina-native-caret-overlay-style';
const CARET_CLASS = 'vlaina-native-caret-overlay';
const ACTIVE_ATTR = 'data-vlaina-native-caret-overlay-active';

const TEXT_INPUT_TYPES = new Set([
  '',
  'email',
  'number',
  'password',
  'search',
  'tel',
  'text',
  'url',
]);

const COPIED_STYLE_PROPERTIES = [
  'boxSizing',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'fontFamily',
  'fontSize',
  'fontStyle',
  'fontVariant',
  'fontVariantNumeric',
  'fontWeight',
  'fontStretch',
  'letterSpacing',
  'lineHeight',
  'textTransform',
  'textIndent',
  'textAlign',
  'direction',
  'wordSpacing',
  'tabSize',
] as const;

const SINGLE_LINE_INPUT_CARET_HEIGHT_RATIO = 0.56;

type TextControl = HTMLInputElement | HTMLTextAreaElement;

function ensureStyle(doc: Document): void {
  if (doc.getElementById(STYLE_ID)) return;

  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = createCaretOverlayStyle({
    activeSelector: `[${ACTIVE_ATTR}='true']`,
    caretClass: CARET_CLASS,
    keyframesName: 'vlaina-native-caret-blink',
  });
  doc.head.appendChild(style);
}

function isTextControl(element: Element | null): element is TextControl {
  if (element instanceof HTMLTextAreaElement) return true;
  if (!(element instanceof HTMLInputElement)) return false;
  return TEXT_INPUT_TYPES.has(element.type);
}

function parsePx(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function resolveLineHeight(styles: CSSStyleDeclaration): number {
  const lineHeight = parsePx(styles.lineHeight);
  if (lineHeight > 0) return lineHeight;
  const fontSize = parsePx(styles.fontSize);
  return fontSize > 0 ? fontSize * 1.2 : 16;
}

function copyTextMetrics(source: CSSStyleDeclaration, target: HTMLElement): void {
  for (const property of COPIED_STYLE_PROPERTIES) {
    target.style[property] = source[property];
  }
}

function getCollapsedSelectionStart(control: TextControl): number | null {
  try {
    const selectionStart = control.selectionStart;
    const selectionEnd = control.selectionEnd;
    if (selectionStart !== null && selectionEnd !== null) {
      return selectionStart === selectionEnd ? selectionStart : null;
    }
  } catch {
    // Some text-like input types, such as email and number, do not expose text selection APIs.
  }

  if (control instanceof HTMLInputElement) {
    return control.value.length;
  }

  return null;
}

function createMirror(control: TextControl, styles: CSSStyleDeclaration): HTMLDivElement {
  const mirror = control.ownerDocument.createElement('div');
  copyTextMetrics(styles, mirror);
  mirror.style.position = 'fixed';
  mirror.style.visibility = 'hidden';
  mirror.style.pointerEvents = 'none';
  mirror.style.whiteSpace = control instanceof HTMLTextAreaElement ? 'pre-wrap' : 'pre';
  mirror.style.overflowWrap = control instanceof HTMLTextAreaElement ? 'break-word' : 'normal';
  mirror.style.overflow = 'hidden';
  mirror.style.width = `${control.getBoundingClientRect().width}px`;
  mirror.style.top = '0';
  mirror.style.left = '0';
  mirror.style.zIndex = '-1';
  return mirror;
}

function resolveSingleLineInputCaretHeight(
  controlRect: DOMRect,
  contentHeight: number,
  markerHeight: number,
  lineHeight: number,
): number {
  const boundedContentHeight = contentHeight > 0 ? contentHeight : controlRect.height;
  const controlScaledHeight = controlRect.height * SINGLE_LINE_INPUT_CARET_HEIGHT_RATIO;
  const inputHeight = Math.min(boundedContentHeight, controlScaledHeight);
  return Math.max(markerHeight, lineHeight, inputHeight);
}

function getControlCaretRect(control: TextControl): { left: number; top: number; bottom: number } | null {
  const selectionStart = getCollapsedSelectionStart(control);
  if (selectionStart === null) return null;

  const styles = control.ownerDocument.defaultView?.getComputedStyle(control);
  if (!styles) return null;

  const controlRect = control.getBoundingClientRect();
  if (controlRect.width <= 0 || controlRect.height <= 0) return null;

  const mirror = createMirror(control, styles);
  const textBeforeCaret = control.value.slice(0, selectionStart);
  if (textBeforeCaret.length > 0) {
    mirror.appendChild(control.ownerDocument.createTextNode(textBeforeCaret));
  }

  const marker = control.ownerDocument.createElement('span');
  marker.textContent = '\u200b';
  mirror.appendChild(marker);
  control.ownerDocument.body.appendChild(mirror);

  const markerRect = marker.getBoundingClientRect();
  mirror.remove();

  const lineHeight = resolveLineHeight(styles);
  const borderLeft = parsePx(styles.borderLeftWidth);
  const borderTop = parsePx(styles.borderTopWidth);
  const paddingLeft = parsePx(styles.paddingLeft);
  const paddingTop = parsePx(styles.paddingTop);
  const paddingBottom = parsePx(styles.paddingBottom);
  const borderBottom = parsePx(styles.borderBottomWidth);
  const fallbackLeft = controlRect.left + borderLeft + paddingLeft;
  const fallbackTop = controlRect.top + borderTop + paddingTop;
  const left = controlRect.left + markerRect.left - parsePx(mirror.style.left) - control.scrollLeft;
  const markerHeight = markerRect.height;
  const measuredTop = controlRect.top + markerRect.top - parsePx(mirror.style.top) - control.scrollTop;
  const contentTop = controlRect.top + borderTop + paddingTop;
  const contentHeight = controlRect.height - borderTop - borderBottom - paddingTop - paddingBottom;
  const inputCaretHeight = control instanceof HTMLInputElement
    ? resolveSingleLineInputCaretHeight(controlRect, contentHeight, markerHeight, lineHeight)
    : markerHeight;
  const top = control instanceof HTMLInputElement && inputCaretHeight > 0 && contentHeight > 0
    ? contentTop + (contentHeight - inputCaretHeight) / 2
    : measuredTop;

  const rect = {
    left: Number.isFinite(left) ? left : fallbackLeft,
    top: Number.isFinite(top) ? top : fallbackTop,
    bottom: Number.isFinite(top) && inputCaretHeight > 0
      ? top + inputCaretHeight
      : fallbackTop + lineHeight,
  };

  return rect;
}

export function useNativeCaretOverlay(): void {
  useEffect(() => {
    const doc = document;
    ensureStyle(doc);

    let caret: HTMLElement | null = null;
    let frameId: number | null = null;

    const hide = () => {
      caret?.remove();
      caret = null;
      doc.querySelectorAll(`[${ACTIVE_ATTR}='true']`).forEach((element) => {
        element.removeAttribute(ACTIVE_ATTR);
      });
    };

    const render = () => {
      frameId = null;

      const activeElement = doc.activeElement;
      if (!isTextControl(activeElement) || activeElement.matches('[readonly], [disabled]')) {
        hide();
        return;
      }

      const rect = getControlCaretRect(activeElement);
      if (!rect) {
        hide();
        return;
      }

      if (!caret) {
        caret = doc.createElement('div');
        caret.className = CARET_CLASS;
        doc.body.appendChild(caret);
      }

      const overlayRect = createCaretOverlayRect(rect);
      caret.style.left = `${overlayRect.left}px`;
      caret.style.top = `${overlayRect.top}px`;
      caret.style.height = `${overlayRect.height}px`;
      activeElement.setAttribute(ACTIVE_ATTR, 'true');
    };

    const schedule = () => {
      if (frameId !== null) return;
      frameId = window.requestAnimationFrame(render);
    };

    const handleFocusIn = () => schedule();
    const handleFocusOut = () => hide();
    const handleUpdate = () => schedule();
    const handleCompositionStart = () => hide();
    const handleCompositionEnd = () => schedule();

    doc.addEventListener('focusin', handleFocusIn);
    doc.addEventListener('focusout', handleFocusOut);
    doc.addEventListener('input', handleUpdate);
    doc.addEventListener('keyup', handleUpdate);
    doc.addEventListener('mouseup', handleUpdate);
    doc.addEventListener('selectionchange', handleUpdate);
    doc.addEventListener('compositionstart', handleCompositionStart);
    doc.addEventListener('compositionend', handleCompositionEnd);
    doc.addEventListener('scroll', handleUpdate, true);
    window.addEventListener('resize', handleUpdate);

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      hide();
      doc.removeEventListener('focusin', handleFocusIn);
      doc.removeEventListener('focusout', handleFocusOut);
      doc.removeEventListener('input', handleUpdate);
      doc.removeEventListener('keyup', handleUpdate);
      doc.removeEventListener('mouseup', handleUpdate);
      doc.removeEventListener('selectionchange', handleUpdate);
      doc.removeEventListener('compositionstart', handleCompositionStart);
      doc.removeEventListener('compositionend', handleCompositionEnd);
      doc.removeEventListener('scroll', handleUpdate, true);
      window.removeEventListener('resize', handleUpdate);
    };
  }, []);
}
