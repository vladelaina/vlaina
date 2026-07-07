import { $prose } from '@milkdown/kit/utils';
import { Plugin, Selection, TextSelection } from '@milkdown/kit/prose/state';
import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import type { EditorView } from '@milkdown/kit/prose/view';
import {
  getHeadingDropPayload,
  hasExternalTextDrag,
  hasHeadingDropPayload,
} from './externalTextDropPayload';
import { markEditorUserInput } from '../shared/userInputEvents';
import { createCaretOverlayRect } from '@/lib/ui/caretOverlayStyles';

export {
  MAX_EXTERNAL_TEXT_DRAG_TYPE_SCAN,
  hasExternalTextDrag,
  hasHeadingDropPayload,
} from './externalTextDropPayload';

const EXTERNAL_TEXT_DROP_CURSOR_CLASS = 'editor-external-text-drop-cursor';

type EditorViewWithDragging = EditorView & {
  dragging?: unknown;
};

interface CursorRect {
  left: number;
  right?: number;
  top: number;
  bottom: number;
}

interface BlockDropTarget {
  pos: number;
  rect: CursorRect;
}

function getCursorRect(view: EditorView, event: DragEvent): CursorRect | null {
  const posInfo = view.posAtCoords({
    left: event.clientX,
    top: event.clientY,
  });
  if (!posInfo) return null;

  try {
    return view.coordsAtPos(posInfo.pos);
  } catch {
    return null;
  }
}

function positionCursor(cursor: HTMLElement, rect: CursorRect) {
  const overlayRect = createCaretOverlayRect(rect);

  cursor.classList.remove('block');
  cursor.style.left = `${Math.round(overlayRect.left)}px`;
  cursor.style.top = `${Math.round(overlayRect.top)}px`;
  cursor.style.width = '';
  cursor.style.height = `${Math.round(overlayRect.height)}px`;
  cursor.classList.add('visible');
}

function positionBlockCursor(cursor: HTMLElement, rect: CursorRect) {
  const right = rect.right ?? rect.left;

  cursor.classList.add('block');
  cursor.style.left = `${Math.round(rect.left)}px`;
  cursor.style.top = `${Math.round(rect.top - 1)}px`;
  cursor.style.width = `${Math.max(24, Math.round(right - rect.left))}px`;
  cursor.style.height = '';
  cursor.classList.add('visible');
}

function isInternalTextSelectionDrag(view: EditorView): boolean {
  return Boolean((view as EditorViewWithDragging).dragging)
    && view.state.selection instanceof TextSelection
    && !view.state.selection.empty;
}

function getTopLevelBlockDropTarget(view: EditorView, event: DragEvent): BlockDropTarget | null {
  const posInfo = view.posAtCoords({
    left: event.clientX,
    top: event.clientY,
  });
  if (!posInfo) return null;

  const doc = view.state.doc;
  const pos = Math.max(0, Math.min(posInfo.pos, doc.content.size));
  const $pos = doc.resolve(pos);
  let depth = $pos.depth;
  while (depth > 0 && !$pos.node(depth).isBlock) {
    depth -= 1;
  }
  if (depth <= 0) {
    const editorRect = view.dom.getBoundingClientRect();
    return {
      pos,
      rect: {
        left: editorRect.left,
        right: editorRect.right,
        top: event.clientY,
        bottom: event.clientY,
      },
    };
  }

  const blockStart = $pos.before(depth);
  const blockEnd = $pos.after(depth);
  const blockDom = view.nodeDOM(blockStart);
  const editorRect = view.dom.getBoundingClientRect();
  const blockRect = blockDom instanceof HTMLElement
    ? blockDom.getBoundingClientRect()
    : view.coordsAtPos(pos);
  const isAtTextblockEnd = $pos.parent.isTextblock && pos >= $pos.end(depth);
  const insertAfter = isAtTextblockEnd || event.clientY > (blockRect.top + blockRect.bottom) / 2;
  const targetY = insertAfter ? blockRect.bottom : blockRect.top;

  return {
    pos: insertAfter ? blockEnd : blockStart,
    rect: {
      left: editorRect.left,
      right: editorRect.right,
      top: targetY,
      bottom: targetY,
    },
  };
}

function createHeadingDropNode(view: EditorView, event: DragEvent): ProseNode | null {
  const heading = getHeadingDropPayload(event.dataTransfer);
  if (!heading) return null;

  const headingType = view.state.schema.nodes.heading;
  if (!headingType) return null;

  return headingType.create({ level: heading.level }, view.state.schema.text(heading.text));
}

function insertExternalHeadingDrop(view: EditorView, event: DragEvent): boolean {
  if ((view as EditorViewWithDragging).dragging) return false;

  const headingNode = createHeadingDropNode(view, event);
  if (!headingNode) return false;

  const target = getTopLevelBlockDropTarget(view, event);
  if (!target) return false;

  let tr = view.state.tr;
  try {
    tr = tr.insert(target.pos, headingNode);
  } catch {
    return false;
  }

  const selectionPos = Math.min(target.pos + headingNode.nodeSize, tr.doc.content.size);
  tr.setSelection(Selection.near(tr.doc.resolve(selectionPos), -1));

  event.preventDefault();
  view.dispatch(tr.scrollIntoView());
  markEditorUserInput(view);
  view.focus();
  return true;
}

export const externalTextDropCursorPlugin = $prose(() => {
  let cursor: HTMLDivElement | null = null;

  const ensureCursor = (view: EditorView) => {
    if (cursor) return cursor;
    cursor = view.dom.ownerDocument.createElement('div');
    cursor.className = EXTERNAL_TEXT_DROP_CURSOR_CLASS;
    cursor.setAttribute('aria-hidden', 'true');
    view.dom.ownerDocument.body.appendChild(cursor);
    return cursor;
  };

  const hideCursor = () => {
    cursor?.classList.remove('visible');
  };

  const removeCursor = () => {
    cursor?.remove();
    cursor = null;
  };

  return new Plugin({
    view() {
      return {
        destroy: removeCursor,
      };
    },
    props: {
      handleDOMEvents: {
        dragover(view, event) {
          const internalTextDrag = isInternalTextSelectionDrag(view);
          if (!internalTextDrag && !hasExternalTextDrag(event.dataTransfer)) {
            hideCursor();
            return false;
          }

          if (!internalTextDrag && hasHeadingDropPayload(event.dataTransfer)) {
            const target = getTopLevelBlockDropTarget(view, event);
            if (!target) {
              hideCursor();
              return false;
            }
            positionBlockCursor(ensureCursor(view), target.rect);
            return false;
          }

          const rect = getCursorRect(view, event);
          if (!rect) {
            hideCursor();
            return false;
          }

          positionCursor(ensureCursor(view), rect);
          return false;
        },
        dragleave(view, event) {
          const nextTarget = event.relatedTarget;
          if (nextTarget instanceof Node && view.dom.contains(nextTarget)) {
            return false;
          }

          hideCursor();
          return false;
        },
        drop(view, event) {
          hideCursor();
          return insertExternalHeadingDrop(view, event);
        },
        dragend() {
          hideCursor();
          return false;
        },
      },
    },
  });
});
