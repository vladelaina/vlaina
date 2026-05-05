import type { EditorView } from '@milkdown/kit/prose/view';
import { getScrollRoot } from '../floating-toolbar/floatingToolbarDom';
import { createTextEditorPopupAnchorResizeTracker } from '../shared/textEditorPopupAnchorResize';
import {
  resizeTextEditorPopupTextareaToContent,
  TEXT_EDITOR_POPUP_CARD_SELECTOR,
} from '../shared/textEditorPopupDom';
import { mountMathEditorCard } from './mathEditorPopupDom';
import {
  cancelMathEditorSession,
  saveMathEditorSession,
  type MathEditorSessionRefs,
} from './mathEditorSessionActions';
import { mathEditorPluginKey } from './mathEditorPluginKey';
import { renderMathEditorLivePreview } from './mathEditorLivePreview';
import {
  getMathAnchorViewportPosition,
  resolveMathAnchorElement,
  resolveMathEditorPlacement,
} from './mathEditorPlacement';
import type { MathEditorState } from './types';

export function createMathEditorViewSession(args: {
  editorView: EditorView;
  onOutsideCloseIntent: () => void;
}) {
  const { editorView, onOutsideCloseIntent } = args;
  const refs: MathEditorSessionRefs = {
    textareaElement: null,
    draftLatex: '',
    initialLatex: '',
  };
  let editorElement: HTMLElement | null = null;
  let renderedState: Pick<MathEditorState, 'nodePos' | 'displayMode'> | null = null;
  let suppressOutsideMouseDown = false;
  let suppressOutsideMouseDownTimer: number | null = null;
  let focusTextareaTimer: number | null = null;
  const scrollRoot = getScrollRoot(editorView);
  const contentRoot = editorView.dom.closest('[data-note-content-root="true"]') as HTMLElement | null;
  const positionRoot = contentRoot ?? scrollRoot;

  const getEditorState = () =>
    mathEditorPluginKey.getState(editorView.state) as MathEditorState | undefined;

  const resolveCurrentAnchorElement = (state: MathEditorState | undefined) => {
    if (!state?.isOpen) {
      return null;
    }

    const nodeDom = typeof editorView.nodeDOM === 'function' ? editorView.nodeDOM(state.nodePos) : null;
    return resolveMathAnchorElement(null, nodeDom);
  };

  const clearEditorElements = () => {
    if (editorElement) {
      editorElement.remove();
    }
    editorElement = null;
    refs.textareaElement = null;
  };

  const resetRenderedState = () => {
    refs.draftLatex = '';
    refs.initialLatex = '';
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
      saveMathEditorSession(getSessionActionArgs());
    }
  };

  const resolveViewportPosition = (state: MathEditorState) => {
    const anchor = resolveCurrentAnchorElement(state);
    return anchor ? getMathAnchorViewportPosition(anchor) : state.position;
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
    editorElement.className = 'text-editor-popup math-editor-popup';
    editorElement.style.position = positionRoot ? 'absolute' : 'fixed';
    editorElement.style.zIndex = '80';
    (positionRoot ?? document.body).appendChild(editorElement);
    return editorElement;
  };

  const renderEditor = (state: MathEditorState) => {
    const container = ensureEditorElement();
    refs.initialLatex = state.latex;
    refs.draftLatex = state.latex;

    const { textarea } = mountMathEditorCard({
      container,
      latex: refs.draftLatex,
      displayMode: state.displayMode,
      onInput(nextDraftLatex) {
        refs.draftLatex = nextDraftLatex;
        renderMathEditorLivePreview({
          anchor: resolveCurrentAnchorElement(getEditorState()),
          latex: nextDraftLatex,
          displayMode: state.displayMode,
        });
        anchorResizeTracker.scheduleResize();
      },
      onCancel() {
        renderMathEditorLivePreview({
          anchor: resolveCurrentAnchorElement(getEditorState()),
          latex: refs.initialLatex,
          displayMode: state.displayMode,
        });
        anchorResizeTracker.scheduleResize();
        cancelMathEditorSession(getSessionActionArgs());
      },
      onSave() {
        saveMathEditorSession(getSessionActionArgs());
      },
    });

    refs.textareaElement = textarea;
    renderedState = { nodePos: state.nodePos, displayMode: state.displayMode };
    scheduleOutsideMouseDownSuppression();
    focusTextareaAtEnd();
  };

  const updateEditorPosition = (state: MathEditorState) => {
    if (!editorElement) {
      return;
    }

    const nextPosition = resolveMathEditorPlacement({
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

      if (
        !renderedState ||
        renderedState.nodePos !== state.nodePos ||
        renderedState.displayMode !== state.displayMode ||
        !refs.textareaElement
      ) {
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
