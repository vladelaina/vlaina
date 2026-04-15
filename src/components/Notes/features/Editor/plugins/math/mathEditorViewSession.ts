import type { EditorView } from '@milkdown/kit/prose/view';
import { renderLatex } from './katex';
import {
  getScrollRoot,
} from '../floating-toolbar/floatingToolbarDom';
import { applyMathNodeLatex, removeMathNode } from './mathEditorEditing';
import { mathEditorPluginKey } from './mathEditorPluginKey';
import {
  createMathEditorElements,
  renderMathEditorPreview,
} from './mathEditorPopupDom';
import {
  getMathAnchorViewportPosition,
  resolveMathAnchorElement,
  resolveMathEditorPlacement,
} from './mathEditorPlacement';
import { createClosedMathEditorState, shouldDiscardEmptyMathNodeOnCancel } from './mathEditorState';
import type { MathEditorState } from './types';

export function createMathEditorViewSession(args: {
  editorView: EditorView;
  onOutsideCloseIntent: () => void;
}) {
  const { editorView, onOutsideCloseIntent } = args;
  let editorElement: HTMLElement | null = null;
  let textareaElement: HTMLTextAreaElement | null = null;
  let previewElement: HTMLElement | null = null;
  let draftLatex = '';
  let renderedState: Pick<MathEditorState, 'nodePos' | 'displayMode'> | null = null;
  let suppressOutsideMouseDown = false;
  let suppressOutsideMouseDownTimer: number | null = null;
  const scrollRoot = getScrollRoot(editorView);
  const contentRoot = editorView.dom.closest('[data-note-content-root="true"]') as HTMLElement | null;
  const positionRoot = contentRoot ?? scrollRoot;

  const getEditorState = () =>
    mathEditorPluginKey.getState(editorView.state) as MathEditorState | undefined;

  const clearEditorElements = () => {
    if (editorElement) {
      editorElement.remove();
    }
    editorElement = null;
    textareaElement = null;
    previewElement = null;
  };

  const resetRenderedState = () => {
    draftLatex = '';
    renderedState = null;
  };

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

  const closeEditor = () => {
    clearEditorElements();
    resetRenderedState();
    editorView.dispatch(
      editorView.state.tr.setMeta(mathEditorPluginKey, createClosedMathEditorState())
    );
  };

  const cancelAndClose = () => {
    const state = getEditorState();
    if (state && shouldDiscardEmptyMathNodeOnCancel(state, draftLatex)) {
      removeMathNode(editorView as never, state.nodePos);
    }

    closeEditor();
    editorView.focus();
  };

  const saveAndClose = () => {
    const state = getEditorState();
    if (!state || state.nodePos < 0 || !textareaElement) {
      closeEditor();
      return;
    }

    applyMathNodeLatex(editorView, state.nodePos, draftLatex);

    closeEditor();
    editorView.focus();
  };

  const handleClickOutside = (e: MouseEvent) => {
    if (suppressOutsideMouseDown) {
      return;
    }

    if (editorElement && !editorElement.contains(e.target as Node)) {
      const state = getEditorState();
      onOutsideCloseIntent();

      if (shouldDiscardEmptyMathNodeOnCancel(state, draftLatex)) {
        cancelAndClose();
        return;
      }

      saveAndClose();
    }
  };

  const updatePreview = (displayMode: boolean) => {
    if (!textareaElement || !previewElement) {
      return;
    }

    draftLatex = textareaElement.value;
    const { html, error, errorDetails } = renderLatex(draftLatex, displayMode);
    renderMathEditorPreview({
      preview: previewElement,
      html,
      error,
      errorDetails,
      displayMode,
    });
  };

  const resolveViewportPosition = (state: MathEditorState) => {
    const nodeDom = typeof editorView.nodeDOM === 'function' ? editorView.nodeDOM(state.nodePos) : null;
    const anchor = resolveMathAnchorElement(null, nodeDom);
    return anchor ? getMathAnchorViewportPosition(anchor) : state.position;
  };

  const renderEditor = (state: MathEditorState) => {
    if (!editorElement) {
      return;
    }

    const {
      card,
      textarea,
      preview,
      cancelButton,
      saveButton,
    } = createMathEditorElements();

    editorElement.replaceChildren(card);
    textareaElement = textarea;
    previewElement = preview;
    draftLatex = state.latex;
    textareaElement.value = draftLatex;
    scheduleOutsideMouseDownSuppression();

    textareaElement.addEventListener('input', () => updatePreview(state.displayMode));
    textareaElement.addEventListener('keydown', (e) => {
      if (e.isComposing) {
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        cancelAndClose();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        saveAndClose();
      }
    });

    cancelButton.addEventListener('click', cancelAndClose);
    saveButton.addEventListener('click', saveAndClose);
    renderedState = { nodePos: state.nodePos, displayMode: state.displayMode };
    updatePreview(state.displayMode);

    setTimeout(() => {
      const nextTextarea = textareaElement;
      nextTextarea?.focus();
      const length = nextTextarea?.value.length ?? 0;
      nextTextarea?.setSelectionRange(length, length);
    }, 0);
  };

  document.addEventListener('mousedown', handleClickOutside);

  return {
    update() {
      const state = getEditorState();

      if (!state?.isOpen) {
        clearEditorElements();
        resetRenderedState();
        return;
      }

      if (!editorElement) {
        editorElement = document.createElement('div');
        editorElement.className = 'math-editor-popup';
        editorElement.style.position = positionRoot ? 'absolute' : 'fixed';
        editorElement.style.zIndex = '80';
        (positionRoot ?? document.body).appendChild(editorElement);
      }

      if (
        !renderedState ||
        renderedState.nodePos !== state.nodePos ||
        renderedState.displayMode !== state.displayMode ||
        !textareaElement
      ) {
        renderEditor(state);
      }

      const nextPosition = resolveMathEditorPlacement({
        editorView,
        positionRoot,
        viewportPosition: resolveViewportPosition(state),
      });
      editorElement.style.setProperty('--math-editor-width', `${Math.round(nextPosition.width)}px`);
      editorElement.style.left = `${nextPosition.x}px`;
      editorElement.style.top = `${nextPosition.y}px`;
    },
    destroy() {
      document.removeEventListener('mousedown', handleClickOutside);
      if (suppressOutsideMouseDownTimer !== null && typeof window !== 'undefined') {
        window.clearTimeout(suppressOutsideMouseDownTimer);
      }
      clearEditorElements();
      resetRenderedState();
      suppressOutsideMouseDown = false;
      suppressOutsideMouseDownTimer = null;
    },
  };
}
