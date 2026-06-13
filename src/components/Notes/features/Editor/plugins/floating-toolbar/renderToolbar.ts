import type { EditorView } from '@milkdown/kit/prose/view';
import type { FloatingToolbarState } from './types';
import { TOOLBAR_ACTIONS } from './types';
import { floatingToolbarKey } from './floatingToolbarKey';
import { renderAlignmentDropdown } from './components/AlignmentDropdown';
import { renderBlockDropdown } from './components/BlockDropdown';
import { renderColorPicker } from './components/ColorPicker';
import { abortActiveAiSelectionReview, abortAiSelectionReviewRequest } from './ai/reviewAbort';
import { createToolbarEventDelegation } from './toolbarInteractions';
import type { ToolbarActionControllerOptions } from './toolbarActions';
import { renderToolbarMarkup } from './toolbarMarkup';

export interface ToolbarRenderer {
  render: (view: EditorView, state: FloatingToolbarState) => void;
  destroy: () => void;
}

type AiDropdownController = {
  render: (container: HTMLElement, view: EditorView, onClose: () => void) => void;
  cleanup: () => void;
  destroy: () => void;
};
type AiReviewPanelController = {
  render: (
    container: HTMLElement,
    view: EditorView,
    state: FloatingToolbarState,
    onClose: () => void
  ) => void;
  cleanup: () => void;
  destroy: () => void;
};

export function createToolbarRenderer(
  toolbarElement: HTMLElement,
  options: ToolbarActionControllerOptions = {}
): ToolbarRenderer {
  const eventDelegation = createToolbarEventDelegation(toolbarElement, options);
  let aiDropdownController: AiDropdownController | null = null;
  let aiReviewPanelController: AiReviewPanelController | null = null;
  let aiDropdownControllerPromise: Promise<AiDropdownController> | null = null;
  let aiReviewPanelControllerPromise: Promise<AiReviewPanelController> | null = null;
  let currentState: FloatingToolbarState | null = null;

  const getAiDropdownController = () => {
    if (aiDropdownController) {
      return Promise.resolve(aiDropdownController);
    }

    aiDropdownControllerPromise ??= (() => {
      return import('./components/AiDropdown').then((mod) => {
        aiDropdownController = mod.createAiDropdownController();
        return aiDropdownController;
      });
    })();
    return aiDropdownControllerPromise;
  };

  const getAiReviewPanelController = () => {
    if (aiReviewPanelController) {
      return Promise.resolve(aiReviewPanelController);
    }

    aiReviewPanelControllerPromise ??= (() => {
      return import('./components/AiReviewPanel').then((mod) => {
        aiReviewPanelController = mod.createAiReviewPanelController();
        return aiReviewPanelController;
      });
    })();
    return aiReviewPanelControllerPromise;
  };

  const hideToolbar = (view: EditorView) => {
    if (options.onCloseToolbar?.(view, currentState)) {
      eventDelegation.clearTransientUi();
      return;
    }

    if (currentState?.subMenu === 'aiReview' && currentState.aiReview) {
      abortAiSelectionReviewRequest(currentState.aiReview.requestKey);
      eventDelegation.clearTransientUi();
      view.dispatch(
        view.state.tr.setMeta(floatingToolbarKey, {
          type: TOOLBAR_ACTIONS.CLOSE_AI_REVIEW,
          payload: { requestKey: currentState.aiReview.requestKey },
        })
      );
      return;
    }

    abortActiveAiSelectionReview(view);
    eventDelegation.clearTransientUi();
    view.dispatch(
      view.state.tr.setMeta(floatingToolbarKey, {
        type: TOOLBAR_ACTIONS.HIDE,
      })
    );
  };
  return {
    render(view, state) {
      const previousSubMenu = currentState?.subMenu ?? null;
      currentState = state;
      if (previousSubMenu === 'ai' || state.subMenu === 'ai') {
        aiDropdownController?.cleanup();
      }
      if (previousSubMenu === 'aiReview' || state.subMenu === 'aiReview') {
        aiReviewPanelController?.cleanup();
      }
      eventDelegation.update(view, state);

      toolbarElement.innerHTML = renderToolbarMarkup(state);

      if (state.subMenu === 'ai') {
        const aiGroup = toolbarElement.querySelector('.toolbar-ai-group');
        if (aiGroup instanceof HTMLElement) {
          void getAiDropdownController().then((controller) => {
            if (currentState !== state || !aiGroup.isConnected) {
              return;
            }
            controller.render(aiGroup, view, () => hideToolbar(view));
          }).catch(() => undefined);
        }
      }

      if (state.subMenu === 'aiReview') {
        void getAiReviewPanelController().then((controller) => {
          if (currentState !== state || !toolbarElement.isConnected) {
            return;
          }
          controller.render(toolbarElement, view, state, () => hideToolbar(view));
        }).catch(() => undefined);
      }

      if (state.subMenu === 'block') {
        const blockGroup = toolbarElement.querySelector('.toolbar-block-group');
        if (blockGroup instanceof HTMLElement) {
          renderBlockDropdown(blockGroup, view, state, () => hideToolbar(view));
        }
      }

      if (state.subMenu === 'alignment') {
        const alignmentGroup = toolbarElement.querySelector('.toolbar-alignment-group');
        if (alignmentGroup instanceof HTMLElement) {
          renderAlignmentDropdown(alignmentGroup, view, state, () => hideToolbar(view));
        }
      }

      if (state.subMenu === 'color') {
        const colorGroup = toolbarElement.querySelector('.toolbar-link-color-group');
        if (colorGroup instanceof HTMLElement) {
          renderColorPicker(colorGroup, view, state, () => hideToolbar(view));
        }
      }
    },
    destroy() {
      currentState = null;
      aiDropdownController?.destroy();
      aiReviewPanelController?.destroy();
      eventDelegation.destroy();
    },
  };
}
