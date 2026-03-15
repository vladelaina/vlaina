import type { EditorView } from '@milkdown/kit/prose/view';
import type { FloatingToolbarState } from './types';
import { TOOLBAR_ACTIONS } from './types';
import { floatingToolbarKey } from './floatingToolbarPlugin';
import { copySelectionToClipboard, toggleMark, setLink } from './commands';
import { openAiSelectionReview } from './ai/reviewFlow';
import { applyFormatPreview, clearFormatPreview, hasFormatPreview } from './previewStyles';
import { getLinkUrl } from './selectionHelpers';
import { linkTooltipPluginKey } from '../links';

export interface ToolbarEventDelegationController {
  update: (view: EditorView, state: FloatingToolbarState) => void;
  clearTransientUi: () => void;
  destroy: () => void;
}

export function createToolbarEventDelegation(
  toolbarElement: HTMLElement
): ToolbarEventDelegationController {
  let currentView: EditorView | null = null;
  let currentState: FloatingToolbarState | null = null;
  let copyFeedbackTimer: ReturnType<typeof setTimeout> | null = null;
  let tooltipElement: HTMLElement | null = null;
  let tooltipTimer: ReturnType<typeof setTimeout> | null = null;

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
    tooltip.dataset.side = 'top';

    const rect = button.getBoundingClientRect();
    tooltip.style.left = `${rect.left + rect.width / 2}px`;
    tooltip.style.top = `${rect.top - 8}px`;
    tooltip.style.transform = 'translate(-50%, -100%)';
    tooltip.classList.add('visible');
  };

  const handleToolbarAction = async (
    view: EditorView,
    action: string,
    state: FloatingToolbarState
  ): Promise<boolean> => {
    const markActions: Record<string, string> = {
      bold: 'strong',
      italic: 'emphasis',
      underline: 'underline',
      strike: 'strike_through',
      code: 'inlineCode',
      highlight: 'highlight',
    };

    if (markActions[action]) {
      toggleMark(view, markActions[action]);
      return true;
    }

    if (action === 'link') {
      const linkUrl = getLinkUrl(view);

      if (linkUrl !== null && linkUrl !== '') {
        setLink(view, null);
        return true;
      }

      const { state: editorState, dispatch } = view;
      const { from, to } = editorState.selection;
      dispatch(
        editorState.tr.setMeta(linkTooltipPluginKey, {
          type: 'SHOW_LINK_TOOLTIP',
          from,
          to,
        })
      );
      view.focus();
      return false;
    }

    if (action === 'delete') {
      const { state: editorState, dispatch } = view;
      const { from, to } = editorState.selection;
      if (from < to) {
        dispatch(editorState.tr.delete(from, to));
      }
      view.focus();
      return true;
    }

    if (action === 'copy') {
      const copied = await copySelectionToClipboard(view);
      if (!copied) {
        return false;
      }

      view.dispatch(
        view.state.tr.setMeta(floatingToolbarKey, {
          type: TOOLBAR_ACTIONS.SET_COPIED,
          payload: { copied: true },
        })
      );

      if (copyFeedbackTimer) {
        clearTimeout(copyFeedbackTimer);
      }

      copyFeedbackTimer = setTimeout(() => {
        copyFeedbackTimer = null;
        view.dispatch(
          view.state.tr.setMeta(floatingToolbarKey, {
            type: TOOLBAR_ACTIONS.SET_COPIED,
            payload: { copied: false },
          })
        );
      }, 1200);
      return true;
    }

    if (action === 'ai') {
      openAiSelectionReview(view);
      return false;
    }

    if (action === 'color' || action === 'block' || action === 'alignment') {
      view.dispatch(
        view.state.tr.setMeta(floatingToolbarKey, {
          type: TOOLBAR_ACTIONS.SET_SUB_MENU,
          payload: { subMenu: state.subMenu === action ? null : action },
        })
      );
      return false;
    }

    return false;
  };

  const handleMouseDown = (e: Event) => {
    const target = e.target as HTMLElement;
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

    clearFormatPreview(currentView);

    const action = button.dataset.action;
    if (action) {
      void handleToolbarAction(currentView, action, currentState).then((shouldHideToolbar) => {
        const view = currentView;
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
    if (action && hasFormatPreview(action) && !isActive) {
      applyFormatPreview(currentView, action, false);
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

      if (copyFeedbackTimer) {
        clearTimeout(copyFeedbackTimer);
        copyFeedbackTimer = null;
      }

      if (tooltipElement) {
        tooltipElement.remove();
        tooltipElement = null;
      }

      currentView = null;
      currentState = null;
    },
  };
}
