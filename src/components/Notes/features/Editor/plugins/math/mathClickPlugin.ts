import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import { renderLatex } from '../../utils/katex';
import {
  getScrollRoot,
} from '../floating-toolbar/floatingToolbarDom';
import { applyMathNodeLatex } from './mathEditorEditing';
import {
  describeMathDebugElement,
  describeMathDebugTarget,
  logMathEditorDebug,
} from './mathEditorDebug';
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
          logMathEditorDebug('dom:mousedown:start', {
            button: event instanceof MouseEvent ? event.button : null,
            target: describeMathDebugTarget(event.target),
          });

          if (!(event instanceof MouseEvent)) {
            logMathEditorDebug('dom:mousedown:skip-non-mouse-event');
            return false;
          }

          if (event.button !== 0) {
            logMathEditorDebug('dom:mousedown:skip-non-left-button', { button: event.button });
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
            logMathEditorDebug('dom:mousedown:skip-no-math-element', {
              target: describeMathDebugTarget(event.target),
              mathElement: describeMathDebugElement(mathElement),
            });
            return false;
          }

          try {
            const pos = view.posAtDOM(mathElement, 0);
            logMathEditorDebug('dom:mousedown:resolved-pos', {
              pos,
              mathElement: describeMathDebugElement(mathElement),
            });
            const meta = resolveMathEditorOpenState({
              view,
              pos,
              getPosition,
            });
            if (!meta) {
              logMathEditorDebug('dom:mousedown:skip-no-meta', { pos });
              return false;
            }

            event.preventDefault();
            logMathEditorDebug('dom:mousedown:open', {
              pos,
              meta,
            });
            view.dispatch(view.state.tr.setMeta(mathClickPluginKey, meta));
            return true;
          } catch (error) {
            logMathEditorDebug('dom:mousedown:error', {
              target: describeMathDebugTarget(event.target),
              mathElement: describeMathDebugElement(mathElement),
              error: error instanceof Error ? error.message : String(error),
            });
            return false;
          }
        },
      },
      handleClick(view, pos, event) {
        logMathEditorDebug('handleClick:start', {
          pos,
          target: describeMathDebugTarget(event.target),
        });
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
          logMathEditorDebug('handleClick:open', { pos, meta });
          view.dispatch(view.state.tr.setMeta(mathClickPluginKey, meta));
          return true;
        }

        logMathEditorDebug('handleClick:skip-no-meta', { pos });
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

      logMathEditorDebug('view:init', {
        hasContentRoot: Boolean(contentRoot),
        hasScrollRoot: Boolean(scrollRoot),
        positionRoot: positionRoot?.getAttribute('data-note-content-root') === 'true'
          ? 'content-root'
          : positionRoot?.getAttribute('data-note-scroll-root') === 'true'
            ? 'scroll-root'
            : positionRoot
              ? positionRoot.className
              : 'body',
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
          logMathEditorDebug('view:outside-mousedown:suppression-cleared');
        }, 0);
      };
      
      const closeEditor = () => {
        logMathEditorDebug('view:close', {
          renderedState,
          draftLatexLength: draftLatex.length,
        });
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
      
      const saveAndClose = () => {
        const state = mathClickPluginKey.getState(editorView.state);
        if (!state || state.nodePos < 0 || !textareaElement) {
          logMathEditorDebug('view:save-skip-invalid-state', {
            state,
            hasTextarea: Boolean(textareaElement),
          });
          closeEditor();
          return;
        }
        
        logMathEditorDebug('view:save', {
          nodePos: state.nodePos,
          displayMode: state.displayMode,
          draftLatex,
        });
        applyMathNodeLatex(editorView, state.nodePos, draftLatex);
        
        closeEditor();
        editorView.focus();
      };
      
      const handleClickOutside = (e: MouseEvent) => {
        logMathEditorDebug('view:outside-mousedown', {
          target: describeMathDebugTarget(e.target),
          containsTarget: Boolean(editorElement && editorElement.contains(e.target as Node)),
          suppressOutsideMouseDown,
        });
        if (suppressOutsideMouseDown) {
          logMathEditorDebug('view:outside-mousedown:ignored-during-open-cycle');
          return;
        }

        if (editorElement && !editorElement.contains(e.target as Node)) {
          saveAndClose();
        }
      };

      const updatePreview = (displayMode: boolean) => {
        if (!textareaElement || !previewElement) {
          return;
        }

        draftLatex = textareaElement.value;
        const { html, error, errorDetails } = renderLatex(draftLatex, displayMode);
        logMathEditorDebug('view:update-preview', {
          displayMode,
          draftLatex,
          hasError: Boolean(error),
        });
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
          logMathEditorDebug('view:render-skip-no-editor-element');
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
        logMathEditorDebug('view:render', {
          nodePos: state.nodePos,
          displayMode: state.displayMode,
          latex: state.latex,
        });
        scheduleOutsideMouseDownSuppression();

        textareaElement.addEventListener('input', () => updatePreview(state.displayMode));
        textareaElement.addEventListener('keydown', (e) => {
          logMathEditorDebug('view:keydown', {
            key: e.key,
            ctrlKey: e.ctrlKey,
            metaKey: e.metaKey,
            isComposing: e.isComposing,
          });
          if (e.isComposing) {
            return;
          }

          if (e.key === 'Escape') {
            e.preventDefault();
            closeEditor();
            editorView.focus();
          } else if (e.key === 'Enter') {
            e.preventDefault();
            saveAndClose();
          }
        });

        cancelButton.addEventListener('click', () => {
          closeEditor();
          editorView.focus();
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
          logMathEditorDebug('view:update', {
            state,
            hasEditorElement: Boolean(editorElement),
            hasTextarea: Boolean(textareaElement),
            renderedState,
          });
          
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
          logMathEditorDebug('view:position', {
            nodePos: state.nodePos,
            position: nextPosition,
          });
          editorElement.style.setProperty('--math-editor-width', `${Math.round(nextPosition.width)}px`);
          editorElement.style.left = `${nextPosition.x}px`;
          editorElement.style.top = `${nextPosition.y}px`;
        },
        destroy() {
          logMathEditorDebug('view:destroy');
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
