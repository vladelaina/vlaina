import type { EditorView } from '@milkdown/kit/prose/view';
import {
  createCaretOverlayRect,
  createCaretOverlayStyle,
  holdCaretBlink,
  releaseCaretBlink,
} from '@/lib/ui/caretOverlayStyles';
import { themeDomStyleTokens, themeStyleResetTokens } from '@/styles/themeTokens';
import { SCROLL_ROOT_SELECTOR } from './blankAreaInteractionUtils';
import {
  clearTextBlockCaretOverlay,
  type SerializedRect,
} from './forcedLineEdgeCaret';
import { resolveTextBlockCaretLineHeight } from './textBlockCaretGeometry';

const FORCED_CARET_CLASS = 'editor-forced-line-end-caret-active';
const FORCED_CARET_STYLE_ID = 'editor-forced-line-end-caret-style';

interface ActiveForcedCaret {
  owner: HTMLElement;
  cleanup: () => void;
}

let activeForcedCaret: ActiveForcedCaret | null = null;

function ensureForcedCaretStyle(doc: Document): void {
  if (doc.getElementById(FORCED_CARET_STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = FORCED_CARET_STYLE_ID;
  style.textContent = createCaretOverlayStyle({
    activeSelector: `.ProseMirror.${FORCED_CARET_CLASS}, .ProseMirror.${FORCED_CARET_CLASS} *`,
    caretClass: 'editor-forced-line-end-caret',
    keyframesName: 'editor-forced-line-end-caret-blink',
  });
  doc.head.appendChild(style);
}

function createForcedLineEdgeCaret(
  view: EditorView,
  textRect: SerializedRect,
  forcedCaretX: number,
): () => void {
  const doc = view.dom.ownerDocument;
  ensureForcedCaretStyle(doc);

  const caret = doc.createElement('div');
  const overlayRect = createCaretOverlayRect({
    left: forcedCaretX,
    top: textRect.top,
    bottom: textRect.bottom,
  }, resolveTextBlockCaretLineHeight(view, view.state.selection.head));
  caret.className = 'editor-forced-line-end-caret';
  caret.style.left = `${overlayRect.left}px`;
  caret.style.top = `${overlayRect.top}px`;
  caret.style.height = `${overlayRect.height}px`;
  caret.style.zIndex = themeDomStyleTokens.zIndexForcedCaret;
  const previousInlineCaretColor = view.dom.style.caretColor;
  clearTextBlockCaretOverlay(view);
  doc.body.appendChild(caret);
  holdCaretBlink(caret);
  view.dom.classList.add(FORCED_CARET_CLASS);
  view.dom.style.caretColor = themeStyleResetTokens.colorTransparent;

  let disposed = false;
  const scrollRoot = view.dom.closest(SCROLL_ROOT_SELECTOR);
  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    releaseCaretBlink(caret);
    caret.remove();
    view.dom.classList.remove(FORCED_CARET_CLASS);
    view.dom.style.caretColor = previousInlineCaretColor;
    doc.removeEventListener('mousedown', handleDocumentMouseDown, true);
    view.dom.removeEventListener('keydown', handleKeyDown, true);
    view.dom.removeEventListener('beforeinput', handleBeforeInput, true);
    view.dom.removeEventListener('input', handleInput, true);
    view.dom.removeEventListener('mousedown', handleEditorMouseDown, true);
    view.dom.removeEventListener('blur', handleBlur, true);
    scrollRoot?.removeEventListener('scroll', handleScroll);
    window.removeEventListener('resize', handleResize);
  };
  const handleDocumentMouseDown = () => cleanup();
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.isComposing) return;
    cleanup();
  };
  const handleBeforeInput = () => cleanup();
  const handleInput = () => cleanup();
  const handleEditorMouseDown = () => cleanup();
  const handleBlur = () => cleanup();
  const handleScroll = () => cleanup();
  const handleResize = () => cleanup();

  window.setTimeout(() => {
    if (disposed) return;
    doc.addEventListener('mousedown', handleDocumentMouseDown, true);
    view.dom.addEventListener('keydown', handleKeyDown, true);
    view.dom.addEventListener('beforeinput', handleBeforeInput, true);
    view.dom.addEventListener('input', handleInput, true);
    view.dom.addEventListener('mousedown', handleEditorMouseDown, true);
    view.dom.addEventListener('blur', handleBlur, true);
    scrollRoot?.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize, { passive: true });
  }, 0);

  return cleanup;
}

export function clearForcedCaretForOwner(owner: HTMLElement): void {
  if (activeForcedCaret?.owner !== owner) return;
  const { cleanup } = activeForcedCaret;
  activeForcedCaret = null;
  cleanup();
}

export function setActiveForcedCaret(view: EditorView, textRect: SerializedRect, forcedCaretX: number): void {
  activeForcedCaret?.cleanup();
  activeForcedCaret = null;

  const cleanup = createForcedLineEdgeCaret(view, textRect, forcedCaretX);
  activeForcedCaret = {
    owner: view.dom,
    cleanup: () => {
      if (activeForcedCaret?.owner === view.dom) {
        activeForcedCaret = null;
      }
      cleanup();
    },
  };
}
