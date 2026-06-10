import type { EditorView } from '@milkdown/kit/prose/view';
import { floatingToolbarKey } from '../../floatingToolbarKey';
import { TOOLBAR_ACTIONS } from '../../types';

interface BindAiReviewDragParams {
  container: HTMLElement;
  dragHandle: HTMLElement;
  view: EditorView;
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
    let pendingPoint: { clientX: number; clientY: number } | null = null;
    let dragFrame: number | null = null;

    const dispatchDragPosition = (clientX: number, clientY: number) => {
      const nextLeft = initialLeft + (clientX - startX);
      const nextTop = initialTop + (clientY - startY);
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const maxLeft = Math.max(12, viewportWidth - panelWidth - 12);
      const maxTop = Math.max(12, viewportHeight - panelHeight - 12);

      view.dispatch(
        view.state.tr.setMeta(floatingToolbarKey, {
          type: TOOLBAR_ACTIONS.UPDATE_POSITION,
          payload: {
            dragPosition: {
              x: Math.min(Math.max(12, nextLeft), maxLeft),
              y: Math.min(Math.max(12, nextTop), maxTop),
            },
          },
        })
      );
    };

    const flushPendingDrag = () => {
      dragFrame = null;
      if (!pendingPoint) return;
      const { clientX, clientY } = pendingPoint;
      pendingPoint = null;
      dispatchDragPosition(clientX, clientY);
    };

    const cancelPendingDrag = () => {
      if (dragFrame !== null) {
        window.cancelAnimationFrame(dragFrame);
        dragFrame = null;
      }
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      pendingPoint = {
        clientX: moveEvent.clientX,
        clientY: moveEvent.clientY,
      };

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
