import type { EditorView } from '@milkdown/kit/prose/view';
import { createDragSelectionRect, type RectBounds } from './blockSelectionUtils';

export type BlockDragStartZone = 'outside-editor' | 'below-last-block' | 'external-sidebar-blank';

const BLOCK_SELECTION_PENDING_CLASS = 'editor-block-selection-pending';

interface StartBlockDragSessionOptions {
  view: EditorView;
  event: MouseEvent;
  startZone: BlockDragStartZone;
  dragThreshold: number;
  cursor: string;
  cursorRoot?: HTMLElement | null;
  onActivate: () => void;
  onDragMove: (selectionRect: RectBounds) => void;
  onPlainClick: (startZone: BlockDragStartZone) => void;
  onTeardown?: () => void;
}

export interface BlockDragSessionHandle {
  stop: () => void;
}

export function startBlockDragSession(options: StartBlockDragSessionOptions): BlockDragSessionHandle {
  const {
    view,
    event,
    startZone,
    dragThreshold,
    cursor,
    cursorRoot: providedCursorRoot,
    onActivate,
    onDragMove,
    onPlainClick,
    onTeardown,
  } = options;

  const startX = event.clientX;
  const startY = event.clientY;
  let activated = false;
  let stopped = false;
  let visualStateApplied = false;

  const editorRoot = view.dom.closest('.milkdown-editor') as HTMLElement | null;
  const cursorRoot = providedCursorRoot ?? editorRoot ?? view.dom;
  const ownerDocument = view.dom.ownerDocument;
  const previousCursorRootCursor = cursorRoot.style.cursor;
  const previousViewCursor = view.dom.style.cursor;
  const previousEditorRootCursor = editorRoot?.style.cursor ?? '';
  const ownerWindow = ownerDocument.defaultView ?? window;

  const applyVisualState = (nextCursor: string) => {
    if (!visualStateApplied) {
      view.dom.classList.add(BLOCK_SELECTION_PENDING_CLASS);
      visualStateApplied = true;
    }
    cursorRoot.style.cursor = nextCursor;
    view.dom.style.cursor = nextCursor;
    if (editorRoot && editorRoot !== cursorRoot) editorRoot.style.cursor = nextCursor;
  };

  const teardown = () => {
    if (stopped) return;
    stopped = true;
    cursorRoot.style.cursor = previousCursorRootCursor;
    if (visualStateApplied) {
      view.dom.classList.remove(BLOCK_SELECTION_PENDING_CLASS);
    }
    view.dom.style.cursor = previousViewCursor;
    if (editorRoot && editorRoot !== cursorRoot) editorRoot.style.cursor = previousEditorRootCursor;
    ownerDocument.removeEventListener('mousemove', handleMouseMove, true);
    ownerDocument.removeEventListener('mouseup', handleMouseUp, true);
    ownerWindow.removeEventListener('blur', handleWindowBlur);
    onTeardown?.();
  };

  const handleMouseMove = (moveEvent: MouseEvent) => {
    if ((moveEvent.buttons & 1) === 0) {
      teardown();
      return;
    }

    const dx = moveEvent.clientX - startX;
    const dy = moveEvent.clientY - startY;
    if (!activated && Math.hypot(dx, dy) < dragThreshold) {
      return;
    }

    if (!activated) {
      activated = true;
      applyVisualState(cursor);
      onActivate();
    }

    moveEvent.preventDefault();
    const selectionRect = createDragSelectionRect(startX, startY, moveEvent.clientX, moveEvent.clientY);
    onDragMove(selectionRect);
  };

  const handleMouseUp = () => {
    if (!activated) {
      onPlainClick(startZone);
    }
    teardown();
  };

  const handleWindowBlur = (blurEvent: Event) => {
    if (blurEvent.target !== ownerWindow) {
      return;
    }
    teardown();
  };

  ownerDocument.addEventListener('mousemove', handleMouseMove, true);
  ownerDocument.addEventListener('mouseup', handleMouseUp, true);
  ownerWindow.addEventListener('blur', handleWindowBlur);
  event.preventDefault();

  return {
    stop: teardown,
  };
}
