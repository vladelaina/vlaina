import type { EditorView } from '@milkdown/kit/prose/view';
import type { FloatingToolbarState } from './types';
import { TOOLBAR_ACTIONS } from './types';
import { floatingToolbarKey } from './floatingToolbarKey';
import { renderAlignmentDropdown } from './components/AlignmentDropdown';
import { createAiDropdownController } from './components/AiDropdown';
import { createAiReviewPanelController } from './components/AiReviewPanel';
import { renderBlockDropdown } from './components/BlockDropdown';
import { renderColorPicker } from './components/ColorPicker';
import { abortActiveAiSelectionReview, abortAiSelectionReviewRequest } from './ai/reviewFlow';
import { createToolbarEventDelegation } from './toolbarInteractions';
import type { ToolbarActionControllerOptions } from './toolbarActions';
import { renderToolbarMarkup } from './toolbarMarkup';

export interface ToolbarRenderer {
  render: (view: EditorView, state: FloatingToolbarState) => void;
  destroy: () => void;
}

export function createToolbarRenderer(
  toolbarElement: HTMLElement,
  options: ToolbarActionControllerOptions = {}
): ToolbarRenderer {
  const eventDelegation = createToolbarEventDelegation(toolbarElement, options);
  const aiDropdownController = createAiDropdownController();
  const aiReviewPanelController = createAiReviewPanelController();
  let currentState: FloatingToolbarState | null = null;

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
      currentState = state;
      aiDropdownController.cleanup();
      aiReviewPanelController.cleanup();
      eventDelegation.update(view, state);

      toolbarElement.innerHTML = renderToolbarMarkup(state);

      if (state.subMenu === 'ai') {
        const aiGroup = toolbarElement.querySelector('.toolbar-ai-group');
        if (aiGroup instanceof HTMLElement) {
          aiDropdownController.render(aiGroup, view, () => hideToolbar(view));
        }
      }

      if (state.subMenu === 'aiReview') {
        aiReviewPanelController.render(toolbarElement, view, state, () => hideToolbar(view));
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
      aiDropdownController.destroy();
      aiReviewPanelController.destroy();
      eventDelegation.destroy();
    },
  };
}
