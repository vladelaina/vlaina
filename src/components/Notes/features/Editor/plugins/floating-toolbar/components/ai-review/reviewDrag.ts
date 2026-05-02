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

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const nextLeft = initialLeft + (moveEvent.clientX - startX);
      const nextTop = initialTop + (moveEvent.clientY - startY);
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const maxLeft = Math.max(12, viewportWidth - container.offsetWidth - 12);
      const maxTop = Math.max(12, viewportHeight - container.offsetHeight - 12);

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

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  });
}
