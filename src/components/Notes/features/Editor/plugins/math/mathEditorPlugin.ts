import { $prose } from '@milkdown/kit/utils';
import { Plugin } from '@milkdown/kit/prose/state';
import { resolveMathEditorOpenState } from './mathEditorOpenResolver';
import { mathEditorPluginKey } from './mathEditorPluginKey';
import { getMathAnchorViewportPosition, resolveMathAnchorElement } from './mathEditorPlacement';
import { createClosedMathEditorState } from './mathEditorState';
import { createMathEditorViewSession } from './mathEditorViewSession';
import type { MathEditorState } from './types';

function getSuppressDeadline() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function isHorizontalScrollbarPointerDown(args: {
  event: MouseEvent;
  mathElement: HTMLElement;
}) {
  const { event, mathElement } = args;
  if (typeof window === 'undefined' || mathElement.dataset.type !== 'math-block') {
    return false;
  }

  const target = event.target instanceof HTMLElement ? event.target : null;
  let current: HTMLElement | null = target;

  while (current) {
    const overflowX = window.getComputedStyle(current).overflowX;
    const scrollbarHeight = current.offsetHeight - current.clientHeight;
    const hasHorizontalScrollbar =
      (overflowX === 'auto' || overflowX === 'scroll') &&
      current.scrollWidth > current.clientWidth &&
      scrollbarHeight > 0;

    if (hasHorizontalScrollbar) {
      const rect = current.getBoundingClientRect();
      const hitHorizontalScrollbar =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.bottom - scrollbarHeight &&
        event.clientY <= rect.bottom;

      if (hitHorizontalScrollbar) {
        return true;
      }
    }

    if (current === mathElement) {
      break;
    }

    current = current.parentElement;
  }

  return false;
}

function createOpenMetaResolver(view: {
  state: { doc: { resolve: (pos: number) => unknown; nodeAt: (pos: number) => unknown } };
  nodeDOM?: (pos: number) => Node | null;
}) {
  return (args: { pos: number; target: EventTarget | null }) => {
    const getPosition = (nodePos: number) =>
      getMathAnchorViewportPosition(
        resolveMathAnchorElement(
          args.target,
          typeof view.nodeDOM === 'function' ? view.nodeDOM(nodePos) : null
        )
      );

    return resolveMathEditorOpenState({
      view: view as never,
      pos: args.pos,
      getPosition,
    });
  };
}

export const mathEditorPlugin = $prose(() => {
  let suppressOpenUntil = 0;

  const shouldIgnoreOpen = (state: MathEditorState | null | undefined) => {
    if (state?.isOpen) {
      return true;
    }

    return getSuppressDeadline() < suppressOpenUntil;
  };

  return new Plugin({
    key: mathEditorPluginKey,
    state: {
      init: () => createClosedMathEditorState(),
      apply(tr, state) {
        const meta = tr.getMeta(mathEditorPluginKey);
        if (meta) {
          return { ...state, ...meta };
        }

        return state;
      },
    },
    props: {
      handleDOMEvents: {
        mousedown(view, event) {
          if (shouldIgnoreOpen(mathEditorPluginKey.getState(view.state) as MathEditorState | undefined)) {
            return false;
          }

          if (!(event instanceof MouseEvent) || event.button !== 0) {
            return false;
          }

          const target = event.target instanceof HTMLElement ? event.target : null;
          const mathElement = target?.closest('[data-type="math-block"], [data-type="math-inline"]');
          if (!(mathElement instanceof HTMLElement) || !view.dom.contains(mathElement)) {
            return false;
          }

          if (isHorizontalScrollbarPointerDown({ event, mathElement })) {
            return false;
          }

          try {
            const meta = createOpenMetaResolver(view)({
              pos: view.posAtDOM(mathElement, 0),
              target: event.target,
            });
            if (!meta) {
              return false;
            }

            event.preventDefault();
            view.dispatch(view.state.tr.setMeta(mathEditorPluginKey, meta));
            return true;
          } catch {
            return false;
          }
        },
      },
      handleClick(view, pos, event) {
        if (shouldIgnoreOpen(mathEditorPluginKey.getState(view.state) as MathEditorState | undefined)) {
          return false;
        }

        const target = event.target instanceof HTMLElement ? event.target : null;
        const mathElement = target?.closest('[data-type="math-block"], [data-type="math-inline"]');
        if (mathElement instanceof HTMLElement && view.dom.contains(mathElement)) {
          if (isHorizontalScrollbarPointerDown({ event, mathElement })) {
            return false;
          }
        }

        const meta = createOpenMetaResolver(view)({
          pos,
          target: event.target,
        });
        if (!meta) {
          return false;
        }

        view.dispatch(view.state.tr.setMeta(mathEditorPluginKey, meta));
        return true;
      },
    },
    view(editorView) {
      return createMathEditorViewSession({
        editorView,
        onOutsideCloseIntent() {
          suppressOpenUntil = getSuppressDeadline() + 120;
        },
      });
    },
  });
});
