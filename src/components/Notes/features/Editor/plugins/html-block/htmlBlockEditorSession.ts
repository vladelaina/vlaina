import type { EditorView } from '@milkdown/kit/prose/view';
import { translate } from '@/lib/i18n';
import { createTextEditorViewSession } from '../shared/textEditorViewSession';
import {
  applyHtmlBlockValue,
  closeHtmlBlockEditorSession,
  normalizeHtmlBlockEditorValueForMarkdown,
  removeHtmlBlockNode,
  renderHtmlBlockEditorLivePreview,
  resolveCurrentDraftValue,
} from './htmlBlockEditorActions';
import {
  getHtmlBlockAnchorViewportPosition,
  resolveHtmlBlockAnchorElement,
} from './htmlBlockEditorDom';
import {
  htmlBlockEditorPluginKey,
  type HtmlBlockEditorSessionRefs,
  type HtmlBlockEditorState,
  type HtmlBlockEditorViewLike,
} from './htmlBlockEditorState';

export function createHtmlBlockEditorViewSession(args: {
  editorView: EditorView;
  onOutsideCloseIntent: () => void;
}) {
  const { editorView, onOutsideCloseIntent } = args;
  const refs: HtmlBlockEditorSessionRefs = {
    textareaElement: null,
    draftValue: '',
    initialValue: '',
  };

  return createTextEditorViewSession<HtmlBlockEditorState, HtmlBlockEditorSessionRefs>({
    editorView,
    onOutsideCloseIntent,
    refs,
    popupClassName: 'text-editor-popup math-editor-popup html-block-editor-popup',
    placeholder: translate('editor.htmlBlockPlaceholder'),
    getEditorState: () =>
      htmlBlockEditorPluginKey.getState(editorView.state) as HtmlBlockEditorState | undefined,
    getStateRenderKey: (state) => String(state.nodePos),
    getValue: (state) => state.value,
    setInitialValue: (nextRefs, value) => {
      nextRefs.initialValue = value;
    },
    setDraftValue: (nextRefs, value) => {
      nextRefs.draftValue = value;
    },
    getInitialValue: (nextRefs) => nextRefs.initialValue,
    resetRefs: (nextRefs) => {
      nextRefs.draftValue = '';
      nextRefs.initialValue = '';
    },
    resolveAnchorElement: (_state, nodeDom) => resolveHtmlBlockAnchorElement(null, nodeDom),
    getAnchorViewportPosition: getHtmlBlockAnchorViewportPosition,
    scrollPopupIntoViewOnInitialRender: true,
    constrainTextareaHeightToViewport: false,
    previewInputDebounceMs: 0,
    previewInput({ value, resolveAnchor, scheduleResize }) {
      renderHtmlBlockEditorLivePreview({ anchor: resolveAnchor(), value });
      scheduleResize();
    },
    previewCancel({ value, resolveAnchor, scheduleResize }) {
      renderHtmlBlockEditorLivePreview({ anchor: resolveAnchor(), value });
      scheduleResize();
    },
    cancelSession(sessionArgs) {
      const state = sessionArgs.getEditorState();
      if (state) {
        applyHtmlBlockValue(
          sessionArgs.editorView as unknown as HtmlBlockEditorViewLike,
          state.nodePos,
          sessionArgs.refs.initialValue || state.value
        );
      }
      closeHtmlBlockEditorSession(sessionArgs);
      sessionArgs.editorView.focus();
    },
    saveSession(sessionArgs) {
      const state = sessionArgs.getEditorState();
      if (!state || state.nodePos < 0) {
        closeHtmlBlockEditorSession(sessionArgs);
        return;
      }

      const draftValue = normalizeHtmlBlockEditorValueForMarkdown(resolveCurrentDraftValue(sessionArgs.refs));
      if (!draftValue.trim()) {
        removeHtmlBlockNode(sessionArgs.editorView as unknown as HtmlBlockEditorViewLike, state.nodePos);
      } else {
        applyHtmlBlockValue(
          sessionArgs.editorView as unknown as HtmlBlockEditorViewLike,
          state.nodePos,
          draftValue
        );
      }

      closeHtmlBlockEditorSession(sessionArgs);
      sessionArgs.editorView.focus();
    },
  });
}
