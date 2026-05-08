import { $prose } from '@milkdown/kit/utils';
import { Plugin } from '@milkdown/kit/prose/state';
import { shouldSuppressPreviewEditorOpen } from '../shared/previewContextMenuSuppression';
import {
  findMermaidEditorTargetElement,
  isMermaidScrollbarPointerDown,
  resolveMermaidEditorPointerOpen,
} from './mermaidEditorOpenInteraction';
import { mermaidEditorPluginKey } from './mermaidEditorPluginKey';
import { createClosedMermaidEditorState } from './mermaidEditorState';
import { createMermaidEditorViewSession } from './mermaidEditorViewSession';
import type { MermaidEditorState } from './types';

function getSuppressDeadline() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

const SUPPRESS_CLICK_AFTER_POINTER_OPEN_MS = 250;

export const mermaidEditorPlugin = $prose(() => {
  let suppressOpenUntil = 0;
  let suppressClickUntil = 0;

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
          const mermaidElement = findMermaidEditorTargetElement(view, event.target);

          if (shouldSuppressPreviewEditorOpen() && mermaidElement) {
            event.preventDefault();
            suppressClickUntil = getSuppressDeadline() + SUPPRESS_CLICK_AFTER_POINTER_OPEN_MS;
            return true;
          }

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
          suppressClickUntil = getSuppressDeadline() + SUPPRESS_CLICK_AFTER_POINTER_OPEN_MS;
          view.dispatch(view.state.tr.setMeta(mermaidEditorPluginKey, openRequest.meta));
          return true;
        },
      },
      handleClick(view, _pos, event) {
        const mermaidElement = findMermaidEditorTargetElement(view, event.target);

        if (getSuppressDeadline() < suppressClickUntil) {
          event.preventDefault();
          return true;
        }

        if (!mermaidElement) {
          return false;
        }

        if (shouldSuppressPreviewEditorOpen()) {
          event.preventDefault();
          return true;
        }

        if (shouldIgnoreOpen(mermaidEditorPluginKey.getState(view.state) as MermaidEditorState | undefined)) {
          return false;
        }

        if (isMermaidScrollbarPointerDown({ event, mermaidElement })) {
          return false;
        }

        const openRequest = resolveMermaidEditorPointerOpen({
          view: view as never,
          target: event.target,
        });
        if (!openRequest) {
          return false;
        }

        view.dispatch(view.state.tr.setMeta(mermaidEditorPluginKey, openRequest.meta));
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
