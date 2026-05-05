import { $prose } from '@milkdown/kit/utils';
import { Plugin } from '@milkdown/kit/prose/state';
import {
  findMermaidEditorTargetElement,
  isMermaidScrollbarPointerDown,
  resolveMermaidEditorOpenMeta,
  resolveMermaidEditorPointerOpen,
} from './mermaidEditorOpenInteraction';
import { mermaidEditorPluginKey } from './mermaidEditorPluginKey';
import { createClosedMermaidEditorState } from './mermaidEditorState';
import { createMermaidEditorViewSession } from './mermaidEditorViewSession';
import type { MermaidEditorState } from './types';

function getSuppressDeadline() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

export const mermaidEditorPlugin = $prose(() => {
  let suppressOpenUntil = 0;

  const shouldIgnoreOpen = (state: MermaidEditorState | null | undefined) => {
    if (state?.isOpen) {
      return true;
    }

    return getSuppressDeadline() < suppressOpenUntil;
  };

  return new Plugin({
    key: mermaidEditorPluginKey,
    state: {
      init: () => createClosedMermaidEditorState(),
      apply(tr, state) {
        const meta = tr.getMeta(mermaidEditorPluginKey);
        if (meta) {
          return { ...state, ...meta };
        }

        return state;
      },
    },
    props: {
      handleDOMEvents: {
        mousedown(view, event) {
          if (shouldIgnoreOpen(mermaidEditorPluginKey.getState(view.state) as MermaidEditorState | undefined)) {
            return false;
          }

          if (!(event instanceof MouseEvent) || event.button !== 0) {
            return false;
          }

          const openRequest = resolveMermaidEditorPointerOpen({
            view: view as never,
            target: event.target,
          });
          if (!openRequest) {
            return false;
          }

          if (isMermaidScrollbarPointerDown({ event, mermaidElement: openRequest.mermaidElement })) {
            return false;
          }

          event.preventDefault();
          view.dispatch(view.state.tr.setMeta(mermaidEditorPluginKey, openRequest.meta));
          return true;
        },
      },
      handleClick(view, pos, event) {
        if (shouldIgnoreOpen(mermaidEditorPluginKey.getState(view.state) as MermaidEditorState | undefined)) {
          return false;
        }

        const mermaidElement = findMermaidEditorTargetElement(view, event.target);
        if (mermaidElement && isMermaidScrollbarPointerDown({ event, mermaidElement })) {
          return false;
        }

        const meta = resolveMermaidEditorOpenMeta({
          view: view as never,
          pos,
          target: event.target,
        });
        if (!meta) {
          return false;
        }

        view.dispatch(view.state.tr.setMeta(mermaidEditorPluginKey, meta));
        return true;
      },
    },
    view(editorView) {
      return createMermaidEditorViewSession({
        editorView,
        onOutsideCloseIntent() {
          suppressOpenUntil = getSuppressDeadline() + 120;
        },
      });
    },
  });
});
