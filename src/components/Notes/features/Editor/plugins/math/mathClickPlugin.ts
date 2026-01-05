// Math click handler plugin - enables editing math nodes on click
import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';

export const mathClickPluginKey = new PluginKey('mathClick');

interface MathEditorState {
  isOpen: boolean;
  latex: string;
  displayMode: boolean;
  position: { x: number; y: number };
  nodePos: number;
}

function createInitialState(): MathEditorState {
  return {
    isOpen: false,
    latex: '',
    displayMode: false,
    position: { x: 0, y: 0 },
    nodePos: -1
  };
}

export const mathClickPlugin = $prose(() => {
  return new Plugin({
    key: mathClickPluginKey,
    state: {
      init: () => createInitialState(),
      apply(tr, state) {
        const meta = tr.getMeta(mathClickPluginKey);
        if (meta) {
          return { ...state, ...meta };
        }
        return state;
      }
    },
    props: {
      handleClick(view, pos, event) {
        const { state } = view;
        const $pos = state.doc.resolve(pos);
        
        // Check if clicked on a math node
        const node = state.doc.nodeAt(pos);
        
        // Check for math_block
        if (node?.type.name === 'math_block') {
          const rect = (event.target as HTMLElement).getBoundingClientRect();
          view.dispatch(
            state.tr.setMeta(mathClickPluginKey, {
              isOpen: true,
              latex: node.attrs.latex || '',
              displayMode: true,
              position: { x: rect.left, y: rect.bottom + 4 },
              nodePos: pos
            })
          );
          return true;
        }
        
        // Check for math_inline
        if (node?.type.name === 'math_inline') {
          const rect = (event.target as HTMLElement).getBoundingClientRect();
          view.dispatch(
            state.tr.setMeta(mathClickPluginKey, {
              isOpen: true,
              latex: node.attrs.latex || '',
              displayMode: false,
              position: { x: rect.left, y: rect.bottom + 4 },
              nodePos: pos
            })
          );
          return true;
        }
        
        // Check parent nodes for math wrapper
        for (let d = $pos.depth; d > 0; d--) {
          const parentNode = $pos.node(d);
          if (parentNode.type.name === 'math_block' || parentNode.type.name === 'math_inline') {
            const parentPos = $pos.before(d);
            const rect = (event.target as HTMLElement).getBoundingClientRect();
            view.dispatch(
              state.tr.setMeta(mathClickPluginKey, {
                isOpen: true,
                latex: parentNode.attrs.latex || '',
                displayMode: parentNode.type.name === 'math_block',
                position: { x: rect.left, y: rect.bottom + 4 },
                nodePos: parentPos
              })
            );
            return true;
          }
        }
        
        return false;
      }
    },
    view(editorView) {
      let editorElement: HTMLElement | null = null;
      let textareaElement: HTMLTextAreaElement | null = null;
      
      const closeEditor = () => {
        if (editorElement) {
          editorElement.remove();
          editorElement = null;
          textareaElement = null;
        }
        editorView.dispatch(
          editorView.state.tr.setMeta(mathClickPluginKey, createInitialState())
        );
      };
      
      const saveAndClose = () => {
        const state = mathClickPluginKey.getState(editorView.state);
        if (!state || state.nodePos < 0 || !textareaElement) {
          closeEditor();
          return;
        }
        
        const newLatex = textareaElement.value;
        const node = editorView.state.doc.nodeAt(state.nodePos);
        
        if (node && (node.type.name === 'math_block' || node.type.name === 'math_inline')) {
          editorView.dispatch(
            editorView.state.tr.setNodeMarkup(state.nodePos, undefined, {
              ...node.attrs,
              latex: newLatex
            })
          );
        }
        
        closeEditor();
        editorView.focus();
      };
      
      const handleClickOutside = (e: MouseEvent) => {
        if (editorElement && !editorElement.contains(e.target as Node)) {
          saveAndClose();
        }
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
            }
            return;
          }
          
          if (!editorElement) {
            editorElement = document.createElement('div');
            editorElement.className = 'math-editor-popup';
            document.body.appendChild(editorElement);
          }
          
          editorElement.style.left = `${state.position.x}px`;
          editorElement.style.top = `${state.position.y}px`;
          
          editorElement.innerHTML = `
            <div class="math-editor-header">
              <span class="math-editor-title">${state.displayMode ? 'Block Equation' : 'Inline Math'}</span>
            </div>
            <textarea class="math-editor-textarea" placeholder="Enter LaTeX...">${state.latex}</textarea>
            <div class="math-editor-preview"></div>
            <div class="math-editor-actions">
              <button class="math-editor-btn cancel">Cancel</button>
              <button class="math-editor-btn save">Save</button>
            </div>
          `;
          
          textareaElement = editorElement.querySelector('.math-editor-textarea');
          const previewEl = editorElement.querySelector('.math-editor-preview');
          const cancelBtn = editorElement.querySelector('.cancel');
          const saveBtn = editorElement.querySelector('.save');
          
          // Update preview on input
          const updatePreview = () => {
            if (!textareaElement || !previewEl) return;
            const latex = textareaElement.value;
            
            import('../../utils/katex').then(({ renderLatex }) => {
              const { html } = renderLatex(latex, state.displayMode);
              previewEl.innerHTML = html;
            });
          };
          
          textareaElement?.addEventListener('input', updatePreview);
          updatePreview();
          
          // Focus and select
          setTimeout(() => {
            textareaElement?.focus();
            textareaElement?.select();
          }, 0);
          
          // Handle keyboard
          textareaElement?.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              closeEditor();
              editorView.focus();
            } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              saveAndClose();
            }
          });
          
          cancelBtn?.addEventListener('click', () => {
            closeEditor();
            editorView.focus();
          });
          
          saveBtn?.addEventListener('click', saveAndClose);
        },
        destroy() {
          document.removeEventListener('mousedown', handleClickOutside);
          if (editorElement) {
            editorElement.remove();
          }
        }
      };
    }
  });
});
