import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { dispatchTailBlankClickAction, isClickBelowLastBlock } from './endBlankClickUtils';

export const blankAreaDragBoxPluginKey = new PluginKey('blankAreaDragBox');

const DRAG_THRESHOLD = 4;
const DRAG_BOX_COLOR = 'rgba(39, 131, 222, 0.18)';
const SCROLL_ROOT_SELECTOR = '[data-note-scroll-root="true"]';
const COVER_REGION_SELECTOR = '[data-note-cover-region="true"]';
const INTERACTIVE_SELECTOR = [
  'a',
  'button',
  'input',
  'textarea',
  'select',
  'summary',
  'label',
  '[role="button"]',
  '[contenteditable="false"]',
  '[data-no-editor-drag-box="true"]',
].join(', ');

function getScrollRoot(element: HTMLElement | null): HTMLElement | null {
  if (!element) return null;
  return element.closest(SCROLL_ROOT_SELECTOR) as HTMLElement | null;
}

type DragStartZone = 'outside-editor' | 'below-last-block' | null;

function resolveDragStartZone(view: EditorView, event: MouseEvent): DragStartZone {
  if (!(event.target instanceof HTMLElement)) return null;
  const target = event.target;

  const editorScrollRoot = getScrollRoot(view.dom);
  const targetScrollRoot = getScrollRoot(target);
  if (!editorScrollRoot || !targetScrollRoot || editorScrollRoot !== targetScrollRoot) return null;

  if (target.closest(COVER_REGION_SELECTOR)) return null;
  if (target.closest(INTERACTIVE_SELECTOR)) return null;

  if (view.dom.contains(target)) {
    if (target === view.dom && isClickBelowLastBlock(view.dom, event.clientY)) {
      return 'below-last-block';
    }
    return null;
  }

  return 'outside-editor';
}

function createDragBox(): HTMLDivElement {
  const box = document.createElement('div');
  box.setAttribute('data-editor-drag-box', 'true');
  box.style.position = 'fixed';
  box.style.pointerEvents = 'none';
  box.style.zIndex = '9999';
  box.style.border = `1px solid ${DRAG_BOX_COLOR}`;
  box.style.background = DRAG_BOX_COLOR;
  box.style.borderRadius = '2px';
  box.style.left = '0px';
  box.style.top = '0px';
  box.style.width = '0px';
  box.style.height = '0px';
  return box;
}

function updateDragBox(box: HTMLDivElement, startX: number, startY: number, x: number, y: number): void {
  const left = Math.min(startX, x);
  const top = Math.min(startY, y);
  const width = Math.abs(x - startX);
  const height = Math.abs(y - startY);

  box.style.left = `${left}px`;
  box.style.top = `${top}px`;
  box.style.width = `${width}px`;
  box.style.height = `${height}px`;
}

export const blankAreaDragBoxPlugin = $prose(() => {
  let stopSession: (() => void) | null = null;

  const clearSession = () => {
    if (!stopSession) return;
    stopSession();
    stopSession = null;
  };

  const tryStartSession = (view: EditorView, event: MouseEvent): boolean => {
    if (event.button !== 0) return false;
    if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return false;
    const startZone = resolveDragStartZone(view, event);
    if (!startZone) return false;

    clearSession();

    const startX = event.clientX;
    const startY = event.clientY;
    let activated = false;
    let dragBox: HTMLDivElement | null = null;
    const previousBodyCursor = document.body.style.cursor;
    const previousBodyUserSelect = document.body.style.userSelect;

    const teardown = () => {
      if (dragBox) {
        dragBox.remove();
        dragBox = null;
      }
      document.body.style.cursor = previousBodyCursor;
      document.body.style.userSelect = previousBodyUserSelect;
      document.removeEventListener('mousemove', handleMouseMove, true);
      document.removeEventListener('mouseup', handleMouseUp, true);
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if ((moveEvent.buttons & 1) === 0) {
        clearSession();
        return;
      }

      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      if (!activated && Math.hypot(dx, dy) < DRAG_THRESHOLD) {
        return;
      }

      if (!activated) {
        activated = true;
        dragBox = createDragBox();
        document.body.appendChild(dragBox);
        document.body.style.cursor = 'default';
        document.body.style.userSelect = 'none';
        window.getSelection()?.removeAllRanges();
      }

      moveEvent.preventDefault();
      if (dragBox) {
        updateDragBox(dragBox, startX, startY, moveEvent.clientX, moveEvent.clientY);
      }
    };

    const handleMouseUp = () => {
      if (!activated && startZone === 'below-last-block') {
        dispatchTailBlankClickAction(view);
      }
      clearSession();
    };

    stopSession = teardown;
    document.addEventListener('mousemove', handleMouseMove, true);
    document.addEventListener('mouseup', handleMouseUp, true);
    if (startZone === 'below-last-block') {
      event.preventDefault();
      return true;
    }
    return false;
  };

  return new Plugin({
    key: blankAreaDragBoxPluginKey,
    props: {
      handleDOMEvents: {
        mousedown(view, event) {
          if (!(event instanceof MouseEvent)) return false;
          return tryStartSession(view, event);
        },
      },
    },
    view(view) {
      const doc = view.dom.ownerDocument;
      const handleDocumentMouseDown = (event: MouseEvent) => {
        const target = event.target;
        if (target instanceof Node && view.dom.contains(target)) return;
        tryStartSession(view, event);
      };

      doc.addEventListener('mousedown', handleDocumentMouseDown, true);

      return {
        destroy() {
          doc.removeEventListener('mousedown', handleDocumentMouseDown, true);
          clearSession();
        },
      };
    },
  });
});
