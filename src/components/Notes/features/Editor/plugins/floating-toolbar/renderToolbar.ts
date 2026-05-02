import type { EditorView } from '@milkdown/kit/prose/view';
import type { FloatingToolbarState } from './types';
import { TOOLBAR_ACTIONS } from './types';
import { floatingToolbarKey } from './floatingToolbarKey';
import { renderAlignmentDropdown } from './components/AlignmentDropdown';
import { createAiDropdownController } from './components/AiDropdown';
import { createAiReviewPanelController } from './components/AiReviewPanel';
import { renderBlockDropdown } from './components/BlockDropdown';
import { renderColorPicker } from './components/ColorPicker';
import { abortActiveAiSelectionReview } from './ai/reviewFlow';
import { createToolbarEventDelegation } from './toolbarInteractions';
import { renderToolbarMarkup } from './toolbarMarkup';

export interface ToolbarRenderer {
  render: (view: EditorView, state: FloatingToolbarState) => void;
  destroy: () => void;
}

export function createToolbarRenderer(toolbarElement: HTMLElement): ToolbarRenderer {
  const eventDelegation = createToolbarEventDelegation(toolbarElement);
  const aiDropdownController = createAiDropdownController();
  const aiReviewPanelController = createAiReviewPanelController();

  const hideToolbar = (view: EditorView) => {
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
      aiDropdownController.destroy();
      aiReviewPanelController.destroy();
      eventDelegation.destroy();
    },
  };
}
