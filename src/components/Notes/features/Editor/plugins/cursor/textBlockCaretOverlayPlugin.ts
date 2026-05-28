import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { createCaretOverlayRect, createCaretOverlayStyle } from '@/lib/ui/caretOverlayStyles';

const TEXTBLOCK_CARET_CLASS = 'vlaina-textblock-caret-overlay-active';
const TEXTBLOCK_CARET_STYLE_ID = 'vlaina-textblock-caret-overlay-style';
const TEXTBLOCK_CARET_ELEMENT_CLASS = 'vlaina-textblock-caret-overlay';

export const textBlockCaretOverlayPluginKey = new PluginKey('textBlockCaretOverlay');

function ensureTextBlockCaretStyle(doc: Document): void {
  if (doc.getElementById(TEXTBLOCK_CARET_STYLE_ID)) return;

  const style = doc.createElement('style');
  style.id = TEXTBLOCK_CARET_STYLE_ID;
  style.textContent = createCaretOverlayStyle({
    activeSelector: `.ProseMirror.${TEXTBLOCK_CARET_CLASS}`,
    caretClass: TEXTBLOCK_CARET_ELEMENT_CLASS,
    keyframesName: 'vlaina-textblock-caret-blink',
  });
  doc.head.appendChild(style);
}

export function shouldShowTextBlockCaretOverlay(view: EditorView): boolean {
  if (!view.hasFocus()) return false;
  if (view.composing) return false;

  const { selection } = view.state;
  if (!selection.empty) return false;

  return selection.$from.parent.isTextblock;
}

class TextBlockCaretOverlayView {
  private caret: HTMLElement | null = null;
  private frameId: number | null = null;

  constructor(private view: EditorView) {
    ensureTextBlockCaretStyle(view.dom.ownerDocument);
    view.dom.addEventListener('focus', this.scheduleUpdate);
    view.dom.addEventListener('blur', this.hide);
    view.dom.addEventListener('compositionstart', this.hide);
    view.dom.addEventListener('compositionend', this.scheduleUpdate);
    view.dom.ownerDocument.addEventListener('selectionchange', this.scheduleUpdate);
    view.dom.ownerDocument.defaultView?.addEventListener('resize', this.scheduleUpdate);
    view.dom.closest('[data-note-scroll-root="true"]')?.addEventListener('scroll', this.scheduleUpdate, { passive: true });
    this.scheduleUpdate();
  }

  update(updatedView: EditorView): void {
    this.view = updatedView;
    this.scheduleUpdate();
  }

  destroy(): void {
    this.cancelFrame();
    this.view.dom.removeEventListener('focus', this.scheduleUpdate);
    this.view.dom.removeEventListener('blur', this.hide);
    this.view.dom.removeEventListener('compositionstart', this.hide);
    this.view.dom.removeEventListener('compositionend', this.scheduleUpdate);
    this.view.dom.ownerDocument.removeEventListener('selectionchange', this.scheduleUpdate);
    this.view.dom.ownerDocument.defaultView?.removeEventListener('resize', this.scheduleUpdate);
    this.view.dom.closest('[data-note-scroll-root="true"]')?.removeEventListener('scroll', this.scheduleUpdate);
    this.hide();
  }

  private scheduleUpdate = (): void => {
    if (this.frameId !== null) return;

    const ownerWindow = this.view.dom.ownerDocument.defaultView;
    if (!ownerWindow) return;

    this.frameId = ownerWindow.requestAnimationFrame(() => {
      this.frameId = null;
      this.render();
    });
  };

  private cancelFrame(): void {
    if (this.frameId === null) return;
    this.view.dom.ownerDocument.defaultView?.cancelAnimationFrame(this.frameId);
    this.frameId = null;
  }

  private hide = (): void => {
    this.caret?.remove();
    this.caret = null;
    this.view.dom.classList.remove(TEXTBLOCK_CARET_CLASS);
  };

  private render(): void {
    if (!shouldShowTextBlockCaretOverlay(this.view)) {
      this.hide();
      return;
    }

    let rect: { left: number; top: number; bottom: number };
    try {
      rect = this.view.coordsAtPos(this.view.state.selection.head);
    } catch {
      this.hide();
      return;
    }

    const doc = this.view.dom.ownerDocument;
    if (!this.caret) {
      this.caret = doc.createElement('div');
      this.caret.className = TEXTBLOCK_CARET_ELEMENT_CLASS;
      doc.body.appendChild(this.caret);
    }

    const overlayRect = createCaretOverlayRect(rect);
    this.caret.style.left = `${overlayRect.left}px`;
    this.caret.style.top = `${overlayRect.top}px`;
    this.caret.style.height = `${overlayRect.height}px`;
    this.view.dom.classList.add(TEXTBLOCK_CARET_CLASS);
  }
}

export const textBlockCaretOverlayPlugin = $prose(() => {
  return new Plugin({
    key: textBlockCaretOverlayPluginKey,
    view: (view) => new TextBlockCaretOverlayView(view),
  });
});
