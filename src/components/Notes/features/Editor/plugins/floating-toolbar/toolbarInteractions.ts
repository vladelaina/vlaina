import type { EditorView } from '@milkdown/kit/prose/view';
import type { FloatingToolbarState } from './types';
import { TOOLBAR_ACTIONS } from './types';
import { floatingToolbarKey } from './floatingToolbarKey';
import {
  applyFormatPreview,
  clearFormatPreview,
  commitFormatPreview,
  hasFormatPreview,
} from './previewStyles';
import { createToolbarActionController } from './toolbarActions';
import type { ToolbarActionControllerOptions } from './toolbarActions';

export { focusSelectedCodeBlockAfterDelete } from './toolbarActions';

const PREVIEWED_DIRECT_APPLY_ACTIONS = new Set([
  'bold',
  'italic',
  'underline',
  'strike',
  'code',
  'highlight',
  'link',
]);

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
  let tooltipElement: HTMLElement | null = null;
  let tooltipTimer: ReturnType<typeof setTimeout> | null = null;
  const actionController = createToolbarActionController(() => currentState, options);

  const getTooltipElement = () => {
    if (!tooltipElement) {
      tooltipElement = document.createElement('div');
      tooltipElement.className = 'toolbar-tooltip';
      document.body.appendChild(tooltipElement);
    }
    return tooltipElement;
  };

  const hideTooltip = () => {
    if (tooltipTimer) {
      clearTimeout(tooltipTimer);
      tooltipTimer = null;
    }

    if (tooltipElement) {
      tooltipElement.classList.remove('visible');
    }
  };

  const showTooltip = (button: HTMLElement) => {
    const shortcut = button.dataset.shortcut;
    if (!shortcut) {
      return;
    }

    const tooltip = getTooltipElement();
    const keys = shortcut.split('+').map((k) => `<kbd>${k}</kbd>`).join('');
    tooltip.innerHTML = `
      <span class="toolbar-tooltip-shortcut">${keys}</span>
      <span class="toolbar-tooltip-arrow" aria-hidden="true"></span>
    `;
    tooltip.dataset.side = 'bottom';

    const rect = button.getBoundingClientRect();
    tooltip.style.left = `${rect.left + rect.width / 2}px`;
    tooltip.style.top = `${rect.bottom + 8}px`;
    tooltip.style.transform = 'translate(-50%, 0)';
    tooltip.classList.add('visible');
  };

  const handleMouseDown = (e: Event) => {
    const target = e.target as HTMLElement;
    if (target.closest('select, input, textarea, option')) {
      return;
    }

    if (toolbarElement.contains(target)) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    const button = target.closest('[data-action]') as HTMLElement | null;
    if (!button) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
  };

  const handleClick = (e: Event) => {
    const target = e.target as HTMLElement;
    const button = target.closest('[data-action]') as HTMLElement | null;
    if (!button || !currentView || !currentState) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    const action = button.dataset.action;
    if (action) {
      const preservePreviewDuringApply = PREVIEWED_DIRECT_APPLY_ACTIONS.has(action);
      if (!preservePreviewDuringApply) {
        clearFormatPreview(currentView);
      }

      if (
        preservePreviewDuringApply &&
        commitFormatPreview(currentView, action, button.classList.contains('active'))
      ) {
        const view = currentView;
        clearFormatPreview(view);
        hideTooltip();
        view.dispatch(
          view.state.tr.setMeta(floatingToolbarKey, {
            type: TOOLBAR_ACTIONS.HIDE,
          })
        );
        return;
      }

      void actionController.handleAction(currentView, action).then((shouldHideToolbar) => {
        const view = currentView;
        if (view && preservePreviewDuringApply) {
          clearFormatPreview(view);
        }

        if (!shouldHideToolbar || !view) {
          return;
        }

        clearFormatPreview(view);
        hideTooltip();
        view.dispatch(
          view.state.tr.setMeta(floatingToolbarKey, {
            type: TOOLBAR_ACTIONS.HIDE,
          })
        );
      });
    }
  };

  const handleMouseOver = (e: Event) => {
    const target = e.target as HTMLElement;
    const button = target.closest('[data-action]') as HTMLElement | null;
    if (!button || !currentView) {
      return;
    }

    const action = button.dataset.action;
    const isActive = button.classList.contains('active');
    if (action && hasFormatPreview(action) && (action !== 'link' || isActive)) {
      applyFormatPreview(currentView, action, isActive);
    }

    if (button.dataset.shortcut) {
      hideTooltip();
      tooltipTimer = setTimeout(() => showTooltip(button), 500);
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

    const action = button.dataset.action;
    if (action && hasFormatPreview(action)) {
      clearFormatPreview(currentView);
    }

    hideTooltip();
  };

  toolbarElement.addEventListener('mousedown', handleMouseDown);
  toolbarElement.addEventListener('click', handleClick);
  toolbarElement.addEventListener('mouseover', handleMouseOver);
  toolbarElement.addEventListener('mouseout', handleMouseOut);

  return {
    update(view, state) {
      currentView = view;
      currentState = state;
    },
    clearTransientUi() {
      if (currentView) {
        clearFormatPreview(currentView);
      }
      hideTooltip();
    },
    destroy() {
      toolbarElement.removeEventListener('mousedown', handleMouseDown);
      toolbarElement.removeEventListener('click', handleClick);
      toolbarElement.removeEventListener('mouseover', handleMouseOver);
      toolbarElement.removeEventListener('mouseout', handleMouseOut);

      hideTooltip();
      actionController.destroy();

      if (tooltipElement) {
        tooltipElement.remove();
        tooltipElement = null;
      }

      currentView = null;
      currentState = null;
    },
  };
}
