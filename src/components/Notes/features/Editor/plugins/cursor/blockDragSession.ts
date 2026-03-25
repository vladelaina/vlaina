import type { EditorView } from '@milkdown/kit/prose/view';
import { createDragSelectionRect, type RectBounds } from './blockSelectionUtils';

export type BlockDragStartZone = 'outside-editor' | 'below-last-block';
const DRAGGING_CURSOR_CLASS = 'vlaina-block-dragging-cursor';

interface StartBlockDragSessionOptions {
  view: EditorView;
  event: MouseEvent;
  startZone: BlockDragStartZone;
  dragThreshold: number;
  cursor: string;
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
    onActivate,
    onDragMove,
    onPlainClick,
    onTeardown,
  } = options;

  const startX = event.clientX;
  const startY = event.clientY;
  let activated = false;
  let stopped = false;

  const editorRoot = view.dom.closest('.milkdown-editor') as HTMLElement | null;
  const previousBodyCursor = document.body.style.cursor;
  const previousBodyUserSelect = document.body.style.userSelect;
  const previousViewCursor = view.dom.style.cursor;
  const previousEditorRootCursor = editorRoot?.style.cursor ?? '';

  document.body.style.cursor = 'text';
  view.dom.style.cursor = 'text';
  if (editorRoot) editorRoot.style.cursor = 'text';

  const teardown = () => {
    if (stopped) return;
    stopped = true;
    document.body.style.cursor = previousBodyCursor;
    document.body.style.userSelect = previousBodyUserSelect;
    document.body.classList.remove(DRAGGING_CURSOR_CLASS);
    view.dom.style.cursor = previousViewCursor;
    if (editorRoot) editorRoot.style.cursor = previousEditorRootCursor;
    document.removeEventListener('mousemove', handleMouseMove, true);
    document.removeEventListener('mouseup', handleMouseUp, true);
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
      document.body.style.cursor = cursor;
      document.body.classList.add(DRAGGING_CURSOR_CLASS);
      view.dom.style.cursor = cursor;
      if (editorRoot) editorRoot.style.cursor = cursor;
      document.body.style.userSelect = 'none';
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

  document.addEventListener('mousemove', handleMouseMove, true);
  document.addEventListener('mouseup', handleMouseUp, true);
  event.preventDefault();

  return {
    stop: teardown,
  };
}
