import type { EditorView } from '@milkdown/kit/prose/view';
import { AI_QUICK_ACTIONS } from '../ai/constants';
import { logAiSelectionDebug } from '../ai/debug';
import { createAiSelectionSuggestion } from '../ai/selectionCommands';
import { TOOLBAR_ACTIONS } from '../types';
import { floatingToolbarKey } from '../floatingToolbarPlugin';

export interface AiDropdownController {
  render: (container: HTMLElement, view: EditorView, onClose: () => void) => void;
  cleanup: () => void;
  destroy: () => void;
}

export function createAiDropdownController(): AiDropdownController {
  const cleanup = () => {};

  const render = (container: HTMLElement, view: EditorView, _onClose: () => void) => {
    const dropdown = document.createElement('div');
    dropdown.className = 'toolbar-submenu ai-dropdown';

    dropdown.innerHTML = `
      ${AI_QUICK_ACTIONS.map((action) => `
        <button
          class="ai-dropdown-item"
          data-ai-prompt="${action.prompt}"
          aria-label="${action.label}"
          title="${action.label}"
        >
          <span class="ai-dropdown-item-label">${action.label}</span>
        </button>
      `).join('')}
    `;

    container.appendChild(dropdown);

    dropdown.querySelectorAll<HTMLButtonElement>('[data-ai-prompt]').forEach((button) => {
      let isSubmitting = false;

      button.addEventListener('mousedown', (event) => {
        logAiSelectionDebug('dropdown:mousedown', {
          prompt: button.dataset.aiPrompt ?? '',
        });
        event.preventDefault();
        event.stopPropagation();
      });

      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();

        const prompt = button.dataset.aiPrompt ?? '';
        if (isSubmitting) {
          logAiSelectionDebug('dropdown:click-ignored-submitting', {
            prompt,
          });
          return;
        }

        logAiSelectionDebug('dropdown:click', {
          prompt,
          selectionFrom: view.state.selection.from,
          selectionTo: view.state.selection.to,
        });

        isSubmitting = true;
        button.disabled = true;

        void createAiSelectionSuggestion(view, prompt)
          .then((suggestion) => {
            logAiSelectionDebug('dropdown:complete', {
              prompt,
              applied: Boolean(suggestion),
            });

            if (suggestion) {
              view.dispatch(
                view.state.tr.setMeta(floatingToolbarKey, {
                  type: TOOLBAR_ACTIONS.SET_AI_REVIEW,
                  payload: {
                    aiReview: {
                      ...suggestion,
                      isLoading: false,
                    },
                  },
                })
              );
            }
          })
          .finally(() => {
            isSubmitting = false;
            button.disabled = false;
          });
      });
    });
  };

  return {
    render,
    cleanup,
    destroy() {
      cleanup();
    },
  };
}
