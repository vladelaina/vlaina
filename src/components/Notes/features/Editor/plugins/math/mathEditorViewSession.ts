import type { EditorView } from '@milkdown/kit/prose/view';
import {
  getScrollRoot,
} from '../floating-toolbar/floatingToolbarDom';
import { applyMathNodeLatex, removeMathNode } from './mathEditorEditing';
import { mathEditorPluginKey } from './mathEditorPluginKey';
import {
  createMathEditorElements,
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
  let draftLatex = '';
  let initialLatex = '';
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
  };

  const resetRenderedState = () => {
    draftLatex = '';
    initialLatex = '';
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

  const restoreOriginalLatex = (state: MathEditorState) => {
    applyMathNodeLatex(editorView, state.nodePos, initialLatex || state.latex);
  };

  const syncDraftToNode = (state: MathEditorState) => {
    if (!textareaElement) {
      return;
    }

    draftLatex = textareaElement.value;
    applyMathNodeLatex(editorView, state.nodePos, draftLatex);
  };

  const cancelAndClose = () => {
    const state = getEditorState();
    if (state && shouldDiscardEmptyMathNodeOnCancel(state, draftLatex)) {
      removeMathNode(editorView as never, state.nodePos);
    } else if (state) {
      restoreOriginalLatex(state);
    }

    closeEditor();
    editorView.focus();
  };

  const saveAndClose = () => {
    const state = getEditorState();
    if (!state || state.nodePos < 0) {
      closeEditor();
      return;
    }

    syncDraftToNode(state);
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
      cancelButton,
      saveButton,
    } = createMathEditorElements();

    editorElement.replaceChildren(card);
    textareaElement = textarea;
    initialLatex = state.latex;
    draftLatex = state.latex;
    textareaElement.value = draftLatex;
    scheduleOutsideMouseDownSuppression();

    textareaElement.addEventListener('input', () => syncDraftToNode(state));
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
