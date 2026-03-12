import type { EditorView } from '@milkdown/kit/prose/view';
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { FloatingToolbarState } from './types';
import { TOOLBAR_ACTIONS } from './types';
import { floatingToolbarKey } from './floatingToolbarPlugin';
import { renderAlignmentDropdown } from './components/AlignmentDropdown';
import { AiToolbarModelSelector } from './components/AiToolbarModelSelector';
import { renderBlockDropdown } from './components/BlockDropdown';
import {
  setupToolbarEventDelegation,
  updateToolbarState,
} from './toolbarInteractions';
import { renderToolbarMarkup } from './toolbarMarkup';

export { cleanupToolbarEventDelegation } from './toolbarInteractions';

let aiModelSelectorRoot: Root | null = null;

function cleanupAiModelSelector() {
  aiModelSelectorRoot?.unmount();
  aiModelSelectorRoot = null;
}

function mountAiModelSelector(toolbarElement: HTMLElement) {
  const host = toolbarElement.querySelector('.toolbar-ai-model-selector-slot');
  const input = toolbarElement.querySelector('.toolbar-ai-composer-input');
  if (!(host instanceof HTMLElement) || !(input instanceof HTMLInputElement)) {
    return;
  }

  cleanupAiModelSelector();
  aiModelSelectorRoot = createRoot(host);
  aiModelSelectorRoot.render(
    React.createElement(AiToolbarModelSelector, {
      composerInputRef: { current: input },
    })
  );
}

function syncAiComposerState(toolbarElement: HTMLElement) {
  const input = toolbarElement.querySelector('.toolbar-ai-composer-input');
  const sendButton = toolbarElement.querySelector('.toolbar-ai-send');

  if (!(input instanceof HTMLInputElement) || !(sendButton instanceof HTMLButtonElement)) {
    return;
  }

  const updateDisabledState = () => {
    const hasValue = input.value.trim().length > 0;
    sendButton.disabled = !hasValue;
    sendButton.classList.toggle('is-disabled', !hasValue);
  };

  updateDisabledState();
  input.addEventListener('input', updateDisabledState);
}

export function renderToolbarContent(
  toolbarElement: HTMLElement,
  view: EditorView,
  state: FloatingToolbarState
) {
  cleanupAiModelSelector();
  updateToolbarState(view, state);

  setupToolbarEventDelegation(toolbarElement, view, state);

  toolbarElement.innerHTML = renderToolbarMarkup(state);

  if (state.subMenu === 'ai') {
    requestAnimationFrame(() => {
      mountAiModelSelector(toolbarElement);
      const input = toolbarElement.querySelector('.toolbar-ai-composer-input');
      if (input instanceof HTMLInputElement) {
        input.focus();
      }
      syncAiComposerState(toolbarElement);
    });
  }

  if (state.subMenu === 'block') {
    const blockGroup = toolbarElement.querySelector('.toolbar-block-group');
    if (blockGroup) {
      renderBlockDropdown(blockGroup as HTMLElement, view, state, () => {
        view.dispatch(
          view.state.tr.setMeta(floatingToolbarKey, {
            type: TOOLBAR_ACTIONS.SET_SUB_MENU,
            payload: { subMenu: null },
          })
        );
      });
    }
  }

  if (state.subMenu === 'alignment') {
    const alignmentGroup = toolbarElement.querySelector('.toolbar-alignment-group');
    if (alignmentGroup) {
      renderAlignmentDropdown(alignmentGroup as HTMLElement, view, state, () => {
        view.dispatch(
          view.state.tr.setMeta(floatingToolbarKey, {
            type: TOOLBAR_ACTIONS.SET_SUB_MENU,
            payload: { subMenu: null },
          })
        );
      });
    }
  }
}

export function cleanupToolbarRendering() {
  cleanupAiModelSelector();
}
