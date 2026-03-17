import type { EditorView } from '@milkdown/kit/prose/view';
import { bindAiDropdownInteractions } from './ai-dropdown/actions';
import { createAiDropdownMarkup } from './ai-dropdown/markup';

export interface AiDropdownController {
  render: (container: HTMLElement, view: EditorView, onClose: () => void) => void;
  cleanup: () => void;
  destroy: () => void;
}

export function createAiDropdownController(): AiDropdownController {
  const cleanup = () => {
  };

  const render = (container: HTMLElement, view: EditorView, _onClose: () => void) => {
    const dropdown = document.createElement('div');
    dropdown.className = 'toolbar-submenu ai-dropdown ai-dropdown-nested';
    dropdown.innerHTML = createAiDropdownMarkup();

    container.appendChild(dropdown);
    bindAiDropdownInteractions(dropdown, view);
  };

  return {
    render,
    cleanup,
    destroy() {
      cleanup();
    },
  };
}
