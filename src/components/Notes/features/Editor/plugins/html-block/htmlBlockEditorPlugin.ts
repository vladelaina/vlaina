import { $prose } from '@milkdown/kit/utils';
import { Plugin } from '@milkdown/kit/prose/state';
import { shouldSuppressPreviewEditorOpen } from '../shared/previewContextMenuSuppression';
import {
  findHtmlBlockEditorTargetElement,
  isHtmlBlockScrollbarPointerDown,
  resolveHtmlBlockEditorPointerOpen,
} from './htmlBlockEditorDom';
import { createHtmlBlockEditorViewSession } from './htmlBlockEditorSession';
import {
  createClosedHtmlBlockEditorState,
  getSuppressDeadline,
  htmlBlockEditorPluginKey,
  type HtmlBlockEditorState,
  type HtmlBlockEditorViewLike,
} from './htmlBlockEditorState';
import { HtmlBlockNodeView } from './HtmlBlockNodeView';

export {
  createOpenHtmlBlockEditorState,
  htmlBlockEditorPluginKey,
} from './htmlBlockEditorState';
export { normalizeHtmlBlockEditorValueForMarkdown } from './htmlBlockEditorActions';

const SUPPRESS_CLICK_AFTER_POINTER_OPEN_MS = 250;

export const htmlBlockEditorPlugin = $prose(() => {
  let suppressOpenUntil = 0;
  let suppressClickUntil = 0;

  const shouldIgnoreOpen = (state: HtmlBlockEditorState | null | undefined) => {
    if (state?.isOpen) {
      return true;
    }

    return getSuppressDeadline() < suppressOpenUntil;
  };

  return new Plugin<HtmlBlockEditorState>({
    key: htmlBlockEditorPluginKey,
    state: {
      init: () => createClosedHtmlBlockEditorState(),
      apply(tr, state) {
        const meta = tr.getMeta(htmlBlockEditorPluginKey);
        if (meta) {
          return { ...state, ...meta };
        }

        return state;
      },
    },
    props: {
      nodeViews: {
        html_block: (node, view, getPos) =>
          new HtmlBlockNodeView(node, view, getPos as () => number | undefined),
      },
      handleDOMEvents: {
        mousedown(view, event) {
          const htmlBlockElement = findHtmlBlockEditorTargetElement(view, event.target);

          if (shouldSuppressPreviewEditorOpen() && htmlBlockElement) {
            event.preventDefault();
            suppressClickUntil = getSuppressDeadline() + SUPPRESS_CLICK_AFTER_POINTER_OPEN_MS;
            return true;
          }

          if (shouldIgnoreOpen(htmlBlockEditorPluginKey.getState(view.state))) {
            return false;
          }

          if (!(event instanceof MouseEvent) || event.button !== 0) {
            return false;
          }

          const openRequest = resolveHtmlBlockEditorPointerOpen({
            view: view as unknown as HtmlBlockEditorViewLike,
            target: event.target,
          });
          if (!openRequest) {
            return false;
          }

          if (isHtmlBlockScrollbarPointerDown({
            event,
            htmlBlockElement: openRequest.htmlBlockElement,
          })) {
            return false;
          }

          event.preventDefault();
          suppressClickUntil = getSuppressDeadline() + SUPPRESS_CLICK_AFTER_POINTER_OPEN_MS;
          view.dispatch(view.state.tr.setMeta(htmlBlockEditorPluginKey, openRequest.meta));
          return true;
        },
      },
      handleClick(view, _pos, event) {
        const htmlBlockElement = findHtmlBlockEditorTargetElement(view, event.target);

        if (getSuppressDeadline() < suppressClickUntil) {
          event.preventDefault();
          return true;
        }

        if (!htmlBlockElement) {
          return false;
        }

        if (shouldSuppressPreviewEditorOpen()) {
          event.preventDefault();
          return true;
        }

        if (shouldIgnoreOpen(htmlBlockEditorPluginKey.getState(view.state))) {
          return false;
        }

        if (isHtmlBlockScrollbarPointerDown({ event, htmlBlockElement })) {
          return false;
        }

        const openRequest = resolveHtmlBlockEditorPointerOpen({
          view: view as unknown as HtmlBlockEditorViewLike,
          target: event.target,
        });
        if (!openRequest) {
          return false;
        }

        view.dispatch(view.state.tr.setMeta(htmlBlockEditorPluginKey, openRequest.meta));
        return true;
      },
    },
    view(editorView) {
      const editorSession = createHtmlBlockEditorViewSession({
        editorView,
        onOutsideCloseIntent() {
          suppressOpenUntil = getSuppressDeadline() + 120;
        },
      });

      return {
        update() {
          editorSession.update();
        },
        destroy() {
          editorSession.destroy();
        },
      };
    },
  });
});
