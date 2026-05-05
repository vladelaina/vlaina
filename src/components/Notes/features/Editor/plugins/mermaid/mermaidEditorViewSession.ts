import type { EditorView } from '@milkdown/kit/prose/view';
import { getScrollRoot } from '../floating-toolbar/floatingToolbarDom';
import { createTextEditorPopupAnchorResizeTracker } from '../shared/textEditorPopupAnchorResize';
import { resolveTextEditorPopupPlacement } from '../shared/textEditorPopupPlacement';
import {
  mountTextEditorPopup,
  resizeTextEditorPopupTextareaToContent,
  TEXT_EDITOR_POPUP_CARD_SELECTOR,
} from '../shared/textEditorPopupDom';
import {
  cancelMermaidEditorSession,
  saveMermaidEditorSession,
  type MermaidEditorSessionRefs,
} from './mermaidEditorSessionActions';
import {
  getMermaidAnchorViewportPosition,
  resolveMermaidAnchorElement,
} from './mermaidEditorOpenInteraction';
import { mermaidEditorPluginKey } from './mermaidEditorPluginKey';
import { renderMermaidEditorLivePreview } from './mermaidDom';
import type { MermaidEditorState } from './types';

export function createMermaidEditorViewSession(args: {
  editorView: EditorView;
  onOutsideCloseIntent: () => void;
}) {
  const { editorView, onOutsideCloseIntent } = args;
  const refs: MermaidEditorSessionRefs = {
    textareaElement: null,
    draftCode: '',
    initialCode: '',
  };
  let editorElement: HTMLElement | null = null;
  let renderedState: Pick<MermaidEditorState, 'nodePos'> | null = null;
  let suppressOutsideMouseDown = false;
  let suppressOutsideMouseDownTimer: number | null = null;
  let focusTextareaTimer: number | null = null;
  const scrollRoot = getScrollRoot(editorView);
  const contentRoot = editorView.dom.closest('[data-note-content-root="true"]') as HTMLElement | null;
  const positionRoot = contentRoot ?? scrollRoot;

  const getEditorState = () =>
    mermaidEditorPluginKey.getState(editorView.state) as MermaidEditorState | undefined;

  const resolveCurrentAnchorElement = (state: MermaidEditorState | undefined) => {
    if (!state?.isOpen) {
      return null;
    }

    const nodeDom = typeof editorView.nodeDOM === 'function' ? editorView.nodeDOM(state.nodePos) : null;
    return resolveMermaidAnchorElement(null, nodeDom);
  };

  const clearEditorElements = () => {
    if (editorElement) {
      editorElement.remove();
    }
    editorElement = null;
    refs.textareaElement = null;
  };

  const resetRenderedState = () => {
    refs.draftCode = '';
    refs.initialCode = '';
    renderedState = null;
  };

  const resetSessionDom = () => {
    clearEditorElements();
    resetRenderedState();
  };

  const getSessionActionArgs = () => ({
    editorView,
    refs,
    getEditorState,
    resetSessionDom,
  });

  const scheduleOutsideMouseDownSuppression = () => {
    suppressOutsideMouseDown = true;
    if (suppressOutsideMouseDownTimer !== null && typeof window !== 'undefined') {
      window.clearTimeout(suppressOutsideMouseDownTimer);
    }

    if (typeof window === 'undefined') {
      return;
    }

    suppressOutsideMouseDownTimer = window.setTimeout(() => {
      suppressOutsideMouseDown = false;
      suppressOutsideMouseDownTimer = null;
    }, 0);
  };

  const handleClickOutside = (event: MouseEvent) => {
    if (suppressOutsideMouseDown) {
      return;
    }

    if (editorElement && !editorElement.contains(event.target as Node)) {
      onOutsideCloseIntent();
      saveMermaidEditorSession(getSessionActionArgs());
    }
  };

  const resolveViewportPosition = (state: MermaidEditorState) => {
    const anchor = resolveCurrentAnchorElement(state);
    return anchor ? getMermaidAnchorViewportPosition(anchor) : state.position;
  };

  const anchorResizeTracker = createTextEditorPopupAnchorResizeTracker({
    resolveAnchor: () => resolveCurrentAnchorElement(getEditorState()),
    onAnchorResize() {
      const state = getEditorState();
      if (state?.isOpen) {
        updateEditorPosition(state);
      }
    },
  });

  const focusTextareaAtEnd = () => {
    if (focusTextareaTimer !== null && typeof window !== 'undefined') {
      window.clearTimeout(focusTextareaTimer);
    }

    focusTextareaTimer = window.setTimeout(() => {
      focusTextareaTimer = null;
      const nextTextarea = refs.textareaElement;
      nextTextarea?.focus();
      const length = nextTextarea?.value.length ?? 0;
      nextTextarea?.setSelectionRange(length, length);
    }, 0);
  };

  const ensureEditorElement = () => {
    if (editorElement) {
      return editorElement;
    }

    editorElement = document.createElement('div');
    editorElement.className = 'text-editor-popup math-editor-popup mermaid-editor-popup';
    editorElement.style.position = positionRoot ? 'absolute' : 'fixed';
    editorElement.style.zIndex = '80';
    (positionRoot ?? document.body).appendChild(editorElement);
    return editorElement;
  };

  const renderEditor = (state: MermaidEditorState) => {
    const container = ensureEditorElement();
    refs.initialCode = state.code;
    refs.draftCode = state.code;

    const { textarea } = mountTextEditorPopup({
      container,
      value: refs.draftCode,
      placeholder: 'Enter Mermaid diagram...',
      onInput(nextDraftCode) {
        refs.draftCode = nextDraftCode;
        void renderMermaidEditorLivePreview({
          anchor: resolveCurrentAnchorElement(getEditorState()),
          code: nextDraftCode,
          onRendered: anchorResizeTracker.scheduleResize,
        });
      },
      onCancel() {
        void renderMermaidEditorLivePreview({
          anchor: resolveCurrentAnchorElement(getEditorState()),
          code: refs.initialCode,
          onRendered: anchorResizeTracker.scheduleResize,
        });
        cancelMermaidEditorSession(getSessionActionArgs());
      },
      onSave() {
        saveMermaidEditorSession(getSessionActionArgs());
      },
    });

    refs.textareaElement = textarea;
    renderedState = { nodePos: state.nodePos };
    scheduleOutsideMouseDownSuppression();
    focusTextareaAtEnd();
  };

  const updateEditorPosition = (state: MermaidEditorState) => {
    if (!editorElement) {
      return;
    }

    const nextPosition = resolveTextEditorPopupPlacement({
      editorView,
      positionRoot,
      viewportPosition: resolveViewportPosition(state),
    });
    editorElement.style.setProperty('--math-editor-width', `${Math.round(nextPosition.width)}px`);
    editorElement.style.left = `${nextPosition.x}px`;
    editorElement.style.top = `${nextPosition.y}px`;

    if (refs.textareaElement) {
      const card = editorElement.querySelector(TEXT_EDITOR_POPUP_CARD_SELECTOR);
      if (card instanceof HTMLElement) {
        resizeTextEditorPopupTextareaToContent({
          card,
          textarea: refs.textareaElement,
        });
      }
    }

    anchorResizeTracker.update();
  };

  document.addEventListener('mousedown', handleClickOutside);

  return {
    update() {
      const state = getEditorState();

      if (!state?.isOpen) {
        anchorResizeTracker.update();
        resetSessionDom();
        return;
      }

      if (!renderedState || renderedState.nodePos !== state.nodePos || !refs.textareaElement) {
        renderEditor(state);
      }

      updateEditorPosition(state);
    },
    destroy() {
      document.removeEventListener('mousedown', handleClickOutside);
      if (suppressOutsideMouseDownTimer !== null && typeof window !== 'undefined') {
        window.clearTimeout(suppressOutsideMouseDownTimer);
      }
      if (focusTextareaTimer !== null && typeof window !== 'undefined') {
        window.clearTimeout(focusTextareaTimer);
      }
      anchorResizeTracker.destroy();
      resetSessionDom();
      suppressOutsideMouseDown = false;
      suppressOutsideMouseDownTimer = null;
      focusTextareaTimer = null;
    },
  };
}
