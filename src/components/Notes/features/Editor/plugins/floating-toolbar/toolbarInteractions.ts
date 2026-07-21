import type { EditorView } from '@milkdown/kit/prose/view';
import { TextSelection } from '@milkdown/kit/prose/state';
import type { FloatingToolbarState } from './types';
import { TOOLBAR_ACTIONS } from './types';
import { floatingToolbarKey } from './floatingToolbarKey';
import {
  applyFormatPreview,
  clearFormatPreview,
  commitFormatPreview,
  hasFormatPreview,
} from './previewStyles';
import { collapseSelectionAfterToolbarApply } from './selectionCollapse';
import { createToolbarActionController } from './toolbarActions';
import type { ToolbarActionControllerOptions } from './toolbarActions';
import { ToolbarTooltipController } from './toolbarTooltipController';
import {
  COLLAPSE_SELECTION_AFTER_APPLY_ACTIONS,
  PREVIEWED_DIRECT_APPLY_ACTIONS,
} from './toolbarDirectApplyActions';
import { hasUsableTextRange } from './selectionValidity';

export { focusSelectedCodeBlockAfterDelete } from './toolbarActions';

export interface ToolbarEventDelegationController {
  update: (view: EditorView, state: FloatingToolbarState) => void;
  clearTransientUi: () => void;
  destroy: () => void;
}

export function createToolbarEventDelegation(
  toolbarElement: HTMLElement,
  options: ToolbarActionControllerOptions = {}
): ToolbarEventDelegationController {
  let currentView: EditorView | null = null;
  let currentState: FloatingToolbarState | null = null;
  let handledPointerDownAction: string | null = null;
  const actionController = createToolbarActionController(() => currentState, options);
  const tooltipController = new ToolbarTooltipController();

  const executeToolbarAction = (button: HTMLElement, action: string) => {
    if (!currentView || !currentState) {
      return;
    }

    if (currentView.state.selection.empty && currentState.selectionRange) {
      const { from, to } = currentState.selectionRange;
      if (hasUsableTextRange(currentView.state.doc, from, to)) {
        try {
          currentView.dispatch(
            currentView.state.tr
              .setSelection(TextSelection.create(currentView.state.doc, from, to))
              .setMeta('addToHistory', false)
          );
        } catch {
          // Use the editor's current selection if the stored range is no longer valid.
        }
      }
    }

    const preservePreviewDuringApply = PREVIEWED_DIRECT_APPLY_ACTIONS.has(action);
    const selectionBeforePreviewCommit = currentView.state.selection;
    const docBeforePreviewCommit = currentView.state.doc;
    if (!preservePreviewDuringApply) {
      clearFormatPreview(currentView);
    }

    if (
      preservePreviewDuringApply &&
      commitFormatPreview(currentView, action, button.classList.contains('active'))
    ) {
      const view = currentView;
      const didPreviewChangeDoc = typeof view.state.doc.eq === 'function'
        ? !view.state.doc.eq(docBeforePreviewCommit)
        : true;
      if (didPreviewChangeDoc) {
        clearFormatPreview(view);
        tooltipController.hide();
        view.dispatch(
          view.state.tr.setMeta(floatingToolbarKey, {
            type: TOOLBAR_ACTIONS.HIDE,
          })
        );
        if (COLLAPSE_SELECTION_AFTER_APPLY_ACTIONS.has(action)) {
          collapseSelectionAfterToolbarApply(view);
        }
        return;
      }

      try {
        view.dispatch(view.state.tr.setSelection(selectionBeforePreviewCommit));
      } catch {
        // Fall back to the real command with the editor's current selection.
      }
    }

    if (preservePreviewDuringApply) {
      clearFormatPreview(currentView);
    }

    void actionController.handleAction(currentView, action)
      .then((shouldHideToolbar) => {
        const view = currentView;
        if (view && preservePreviewDuringApply) {
          clearFormatPreview(view);
        }

        if (!shouldHideToolbar || !view) {
          return;
        }

        clearFormatPreview(view);
        tooltipController.hide();
        view.dispatch(
          view.state.tr.setMeta(floatingToolbarKey, {
            type: TOOLBAR_ACTIONS.HIDE,
          })
        );
        if (COLLAPSE_SELECTION_AFTER_APPLY_ACTIONS.has(action)) {
          collapseSelectionAfterToolbarApply(view);
        }
      })
      .catch((error) => {
        console.error('[vlaina-toolbar-action-error]', action, error);
      });
  };

  const handleMouseDown = (e: Event) => {
    const target = e.target as HTMLElement;
    if (target.closest('select, input, textarea, option')) {
      return;
    }

    const button = target.closest('[data-action]') as HTMLElement | null;
    const action = button?.dataset.action;
    if (action && currentView) {
      actionController.prepareAction(currentView, action);
    }

    if (toolbarElement.contains(target)) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    if (!button) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
  };

  const handlePointerDown = (e: Event) => {
    const target = e.target as HTMLElement;
    const button = target.closest('[data-action]') as HTMLElement | null;
    const action = button?.dataset.action;
    if (action && currentView) {
      actionController.prepareAction(currentView, action);
    }
    handledPointerDownAction = null;
    if (action && button && currentView && currentState && PREVIEWED_DIRECT_APPLY_ACTIONS.has(action)) {
      e.preventDefault();
      e.stopPropagation();
      handledPointerDownAction = action;
      executeToolbarAction(button, action);
      return;
    }
    if (action === 'copy') {
      let didClear = false;
      const clearPreparedAction = () => {
        if (didClear) return;
        didClear = true;
        document.removeEventListener('pointerup', clearPreparedAction, true);
        document.removeEventListener('pointercancel', clearPreparedAction, true);
        setTimeout(() => actionController.cancelPreparedAction(action), 0);
      };
      document.addEventListener('pointerup', clearPreparedAction, true);
      document.addEventListener('pointercancel', clearPreparedAction, true);
    }
  };

  const handleClick = (e: Event) => {
    const target = e.target as HTMLElement;
    const button = target.closest('[data-action]') as HTMLElement | null;
    const action = button?.dataset.action;
    if (!button || !currentView || !currentState) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    if (action) {
      if (handledPointerDownAction === action) {
        handledPointerDownAction = null;
        return;
      }

      executeToolbarAction(button, action);
    }
  };

  const handleMouseOver = (e: Event) => {
    const mouseEvent = e as MouseEvent;
    const target = e.target as HTMLElement;
    const button = target.closest('[data-action]') as HTMLElement | null;
    if (!button || !currentView) {
      return;
    }

    const relatedTarget = mouseEvent.relatedTarget as HTMLElement | null;
    if (relatedTarget && button.contains(relatedTarget)) {
      return;
    }

    const action = button.dataset.action;
    const isPreviewableAction = Boolean(action && hasFormatPreview(action));
    const isActive = button.classList.contains('active');
    if (action && isPreviewableAction && (action !== 'link' || isActive)) {
      applyFormatPreview(currentView, action, isActive);
    } else if (action) {
      clearFormatPreview(currentView);
    }

    if (button.dataset.shortcut) {
      tooltipController.hide();
      tooltipController.schedule(button);
    }
  };

  const handleMouseOut = (e: Event) => {
    const mouseEvent = e as MouseEvent;
    const target = e.target as HTMLElement;
    const button = target.closest('[data-action]') as HTMLElement | null;
    if (!button || !currentView) {
      return;
    }

    const relatedTarget = mouseEvent.relatedTarget as HTMLElement | null;
    if (relatedTarget && button.contains(relatedTarget)) {
      return;
    }

    if (relatedTarget && toolbarElement.contains(relatedTarget)) {
      tooltipController.hide();
      return;
    }

    const action = button.dataset.action;
    if (action && hasFormatPreview(action)) {
      clearFormatPreview(currentView);
    }

    tooltipController.hide();
  };

  const handleToolbarMouseLeave = () => {
    if (currentView) {
      clearFormatPreview(currentView);
    }
    tooltipController.hide();
  };

  toolbarElement.addEventListener('pointerdown', handlePointerDown);
  toolbarElement.addEventListener('mousedown', handleMouseDown);
  toolbarElement.addEventListener('click', handleClick);
  toolbarElement.addEventListener('mouseover', handleMouseOver);
  toolbarElement.addEventListener('mouseout', handleMouseOut);
  toolbarElement.addEventListener('mouseleave', handleToolbarMouseLeave);

  return {
    update(view, state) {
      currentView = view;
      currentState = state;
    },
    clearTransientUi() {
      if (currentView) {
        clearFormatPreview(currentView);
      }
      tooltipController.hide();
    },
    destroy() {
      toolbarElement.removeEventListener('pointerdown', handlePointerDown);
      toolbarElement.removeEventListener('mousedown', handleMouseDown);
      toolbarElement.removeEventListener('click', handleClick);
      toolbarElement.removeEventListener('mouseover', handleMouseOver);
      toolbarElement.removeEventListener('mouseout', handleMouseOut);
      toolbarElement.removeEventListener('mouseleave', handleToolbarMouseLeave);

      tooltipController.hide();
      actionController.destroy();
      tooltipController.destroy();

      currentView = null;
      currentState = null;
    },
  };
}
