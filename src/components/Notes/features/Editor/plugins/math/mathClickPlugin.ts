import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import { renderLatex } from '../../utils/katex';
import {
  getScrollRoot,
} from '../floating-toolbar/floatingToolbarDom';
import { applyMathNodeLatex, removeMathNode } from './mathEditorEditing';
import { resolveMathEditorOpenState } from './mathEditorOpen';
import {
  createMathEditorElements,
  renderMathEditorPreview,
} from './mathEditorPopupDom';
import { clampMathEditorPosition, getMathAnchorElement, getMathEditorViewportPosition } from './mathEditorPositioning';
import { createInitialMathEditorState } from './mathEditorState';
import type { MathEditorState } from './types';

export const mathClickPluginKey = new PluginKey('mathClick');

export const mathClickPlugin = $prose(() => {
  let suppressOpenUntil = 0;

  const shouldIgnoreOpen = (state: MathEditorState | null | undefined) => {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (state?.isOpen) {
      return 'already-open';
    }

    if (now < suppressOpenUntil) {
      return 'suppressed-after-close';
    }

    return null;
  };

  return new Plugin({
    key: mathClickPluginKey,
    state: {
      init: () => createInitialMathEditorState(),
      apply(tr, state) {
        const meta = tr.getMeta(mathClickPluginKey);
        if (meta) {
          return { ...state, ...meta };
        }
        return state;
      }
    },
    props: {
      handleDOMEvents: {
        mousedown(view, event) {
          const currentState = mathClickPluginKey.getState(view.state);
          const ignoreReason = shouldIgnoreOpen(currentState);
          if (ignoreReason) {
            return false;
          }

          if (!(event instanceof MouseEvent)) {
            return false;
          }

          if (event.button !== 0) {
            return false;
          }

          const getPosition = (nodePos: number) =>
            getMathEditorViewportPosition(
              getMathAnchorElement(
                event.target,
                typeof view.nodeDOM === 'function' ? view.nodeDOM(nodePos) : null
              )
            );

          const target = event.target instanceof HTMLElement ? event.target : null;
          const mathElement = target?.closest('[data-type="math-block"], [data-type="math-inline"]');
          if (!(mathElement instanceof HTMLElement) || !view.dom.contains(mathElement)) {
            return false;
          }

          try {
            const pos = view.posAtDOM(mathElement, 0);
            const meta = resolveMathEditorOpenState({
              view,
              pos,
              getPosition,
            });
            if (!meta) {
              return false;
            }

            event.preventDefault();
            view.dispatch(view.state.tr.setMeta(mathClickPluginKey, meta));
            return true;
          } catch (error) {
            return false;
          }
        },
      },
      handleClick(view, pos, event) {
        const currentState = mathClickPluginKey.getState(view.state);
        const ignoreReason = shouldIgnoreOpen(currentState);
        if (ignoreReason) {
          return false;
        }

        const getPosition = (nodePos: number) =>
          getMathEditorViewportPosition(
            getMathAnchorElement(
              event.target,
              typeof view.nodeDOM === 'function' ? view.nodeDOM(nodePos) : null
            )
          );
        const meta = resolveMathEditorOpenState({
          view,
          pos,
          getPosition,
        });

        if (meta) {
          view.dispatch(view.state.tr.setMeta(mathClickPluginKey, meta));
          return true;
        }

        return false;
      }
    },
    view(editorView) {
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

      const shouldRemoveNodeOnCancel = (state: MathEditorState | null | undefined) => {
        if (!state?.removeIfCancelledEmpty || state.nodePos < 0) {
          return false;
        }

        if (state.latex.trim() || draftLatex.trim()) {
          return false;
        }

        return true;
      };
      
      const closeEditor = () => {
        if (editorElement) {
          editorElement.remove();
          editorElement = null;
          textareaElement = null;
          previewElement = null;
        }
        draftLatex = '';
        renderedState = null;
        editorView.dispatch(
          editorView.state.tr.setMeta(mathClickPluginKey, createInitialMathEditorState())
        );
      };

      const cancelAndClose = () => {
        const state = mathClickPluginKey.getState(editorView.state);
        if (shouldRemoveNodeOnCancel(state)) {
          removeMathNode(editorView as never, state.nodePos);
        }

        closeEditor();
        editorView.focus();
      };
      
      const saveAndClose = () => {
        const state = mathClickPluginKey.getState(editorView.state);
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
          const state = mathClickPluginKey.getState(editorView.state);
          suppressOpenUntil = (typeof performance !== 'undefined' ? performance.now() : Date.now()) + 120;
          if (shouldRemoveNodeOnCancel(state)) {
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
        const anchor = getMathAnchorElement(null, nodeDom);
        return anchor ? getMathEditorViewportPosition(anchor) : state.position;
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

        cancelButton.addEventListener('click', () => {
          cancelAndClose();
        });

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
          const state = mathClickPluginKey.getState(editorView.state);
          
          if (!state?.isOpen) {
            if (editorElement) {
              editorElement.remove();
              editorElement = null;
              textareaElement = null;
              previewElement = null;
            }
            draftLatex = '';
            renderedState = null;
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

          const nextPosition = clampMathEditorPosition({
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
          if (editorElement) {
            editorElement.remove();
          }
          textareaElement = null;
          previewElement = null;
          draftLatex = '';
          renderedState = null;
          suppressOutsideMouseDown = false;
          suppressOutsideMouseDownTimer = null;
        }
      };
    }
  });
});
