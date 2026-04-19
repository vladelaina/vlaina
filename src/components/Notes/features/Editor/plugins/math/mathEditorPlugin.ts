import { $prose } from '@milkdown/kit/utils';
import { Plugin } from '@milkdown/kit/prose/state';
import {
  findMathEditorTargetElement,
  isHorizontalScrollbarPointerDown,
  resolveMathEditorOpenMeta,
  resolveMathEditorPointerOpen,
} from './mathEditorOpenInteraction';
import { mathEditorPluginKey } from './mathEditorPluginKey';
import { createClosedMathEditorState } from './mathEditorState';
import { createMathEditorViewSession } from './mathEditorViewSession';
import type { MathEditorState } from './types';

function getSuppressDeadline() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
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

          const openRequest = resolveMathEditorPointerOpen({
            view: view as never,
            target: event.target,
          });
          if (!openRequest) {
            return false;
          }

          if (isHorizontalScrollbarPointerDown({ event, mathElement: openRequest.mathElement })) {
            return false;
          }

          event.preventDefault();
          view.dispatch(view.state.tr.setMeta(mathEditorPluginKey, openRequest.meta));
          return true;
        },
      },
      handleClick(view, pos, event) {
        if (shouldIgnoreOpen(mathEditorPluginKey.getState(view.state) as MathEditorState | undefined)) {
          return false;
        }

        const mathElement = findMathEditorTargetElement(view, event.target);
        if (mathElement && isHorizontalScrollbarPointerDown({ event, mathElement })) {
          return false;
        }

        const meta = resolveMathEditorOpenMeta({
          view: view as never,
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
