import type { EditorView } from '@milkdown/kit/prose/view';
import { floatingToolbarKey } from '../../floatingToolbarKey';
import { TOOLBAR_ACTIONS } from '../../types';

interface BindAiReviewDragParams {
  container: HTMLElement;
  dragHandle: HTMLElement;
  view: EditorView;
}

interface AiReviewDragPosition {
  x: number;
  y: number;
}

export function bindAiReviewDrag({
  container,
  dragHandle,
  view,
}: BindAiReviewDragParams) {
  dragHandle.addEventListener('mousedown', (event) => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;
    const startY = event.clientY;
    const initialLeft = Number.parseFloat(container.style.left || '0');
    const initialTop = Number.parseFloat(container.style.top || '0');
    const panelWidth = container.offsetWidth;
    const panelHeight = container.offsetHeight;
    let pendingPosition: AiReviewDragPosition | null = null;
    let dragFrame: number | null = null;

    const getDragPosition = (clientX: number, clientY: number): AiReviewDragPosition => {
      const nextLeft = initialLeft + (clientX - startX);
      const nextTop = initialTop + (clientY - startY);
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const maxLeft = Math.max(12, viewportWidth - panelWidth - 12);
      const maxTop = Math.max(12, viewportHeight - panelHeight - 12);

      return {
        x: Math.min(Math.max(12, nextLeft), maxLeft),
        y: Math.min(Math.max(12, nextTop), maxTop),
      };
    };

    const applyDragPosition = (position: AiReviewDragPosition) => {
      container.style.left = `${position.x}px`;
      container.style.top = `${position.y}px`;
    };

    const dispatchDragPosition = (position: AiReviewDragPosition) => {
      view.dispatch(
        view.state.tr.setMeta(floatingToolbarKey, {
          type: TOOLBAR_ACTIONS.UPDATE_POSITION,
          payload: {
            dragPosition: position,
          },
        })
      );
    };

    const flushPendingDrag = () => {
      dragFrame = null;
      if (!pendingPosition) return;
      const position = pendingPosition;
      pendingPosition = null;
      dispatchDragPosition(position);
    };

    const cancelPendingDrag = () => {
      if (dragFrame !== null) {
        window.cancelAnimationFrame(dragFrame);
        dragFrame = null;
      }
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const position = getDragPosition(moveEvent.clientX, moveEvent.clientY);
      applyDragPosition(position);
      pendingPosition = position;

      if (dragFrame !== null) return;
      dragFrame = window.requestAnimationFrame(flushPendingDrag);
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      cancelPendingDrag();
      flushPendingDrag();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  });
}
