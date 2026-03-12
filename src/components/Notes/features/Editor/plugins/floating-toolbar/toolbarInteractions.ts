import type { EditorView } from '@milkdown/kit/prose/view';
import type { FloatingToolbarState } from './types';
import { TOOLBAR_ACTIONS } from './types';
import { floatingToolbarKey } from './floatingToolbarPlugin';
import { copySelectionToClipboard, toggleMark, setLink } from './commands';
import { applyFormatPreview, clearFormatPreview, hasFormatPreview } from './previewStyles';
import { getLinkUrl } from './selectionHelpers';
import { linkTooltipPluginKey } from '../links';

let copyFeedbackTimer: ReturnType<typeof setTimeout> | null = null;

async function handleToolbarAction(view: EditorView, action: string, state: FloatingToolbarState) {
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
    return;
  }

  if (action === 'link') {
    const linkUrl = getLinkUrl(view);

    if (linkUrl !== null && linkUrl !== '') {
      setLink(view, null);
      return;
    }

    const { state: editorState, dispatch } = view;
    const { from, to } = editorState.selection;
    const tr = editorState.tr.setMeta(linkTooltipPluginKey, {
      type: 'SHOW_LINK_TOOLTIP',
      from,
      to,
    });
    dispatch(tr);
    view.focus();
    return;
  }

  if (action === 'delete') {
    const { state: editorState, dispatch } = view;
    const { from, to } = editorState.selection;
    if (from < to) {
      dispatch(editorState.tr.delete(from, to));
    }
    view.focus();
    return;
  }

  if (action === 'copy') {
    const copied = await copySelectionToClipboard(view);
    if (!copied) {
      return;
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
    return;
  }

  if (action === 'ai' || action === 'color' || action === 'block' || action === 'alignment') {
    view.dispatch(
      view.state.tr.setMeta(floatingToolbarKey, {
        type: TOOLBAR_ACTIONS.SET_SUB_MENU,
        payload: { subMenu: state.subMenu === action ? null : action },
      })
    );
  }
}

let tooltipElement: HTMLElement | null = null;
let tooltipTimer: ReturnType<typeof setTimeout> | null = null;

function getTooltipElement(): HTMLElement {
  if (!tooltipElement) {
    tooltipElement = document.createElement('div');
    tooltipElement.className = 'toolbar-tooltip';
    document.body.appendChild(tooltipElement);
  }
  return tooltipElement;
}

function showTooltip(button: HTMLElement) {
  const tooltip = getTooltipElement();
  const shortcut = button.dataset.shortcut;

  if (!shortcut) return;

  const keys = shortcut.split('+').map((k) => `<kbd>${k}</kbd>`).join('');
  const html = `
    <span class="toolbar-tooltip-shortcut">${keys}</span>
    <span class="toolbar-tooltip-arrow" aria-hidden="true"></span>
  `;

  tooltip.innerHTML = html;
  tooltip.dataset.side = 'top';

  const rect = button.getBoundingClientRect();
  tooltip.style.left = `${rect.left + rect.width / 2}px`;
  tooltip.style.top = `${rect.top - 8}px`;
  tooltip.style.transform = 'translate(-50%, -100%)';
  tooltip.classList.add('visible');
}

function hideTooltip() {
  if (tooltipTimer) {
    clearTimeout(tooltipTimer);
    tooltipTimer = null;
  }

  if (tooltipElement) {
    tooltipElement.classList.remove('visible');
  }
}

let currentView: EditorView | null = null;
let currentState: FloatingToolbarState | null = null;
let delegateHandler: ((e: Event) => void) | null = null;
let hoverHandler: ((e: Event) => void) | null = null;
let leaveHandler: ((e: Event) => void) | null = null;

export function setupToolbarEventDelegation(
  toolbarElement: HTMLElement,
  view: EditorView,
  state: FloatingToolbarState
) {
  currentView = view;
  currentState = state;

  if (delegateHandler) {
    return;
  }

  delegateHandler = (e: Event) => {
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
      void handleToolbarAction(currentView, action, currentState);
    }
  };

  hoverHandler = (e: Event) => {
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

  leaveHandler = (e: Event) => {
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

  toolbarElement.addEventListener('click', delegateHandler);
  toolbarElement.addEventListener('mouseover', hoverHandler);
  toolbarElement.addEventListener('mouseout', leaveHandler);
}

export function updateToolbarState(view: EditorView, state: FloatingToolbarState) {
  currentView = view;
  currentState = state;
}

export function cleanupToolbarEventDelegation(toolbarElement: HTMLElement) {
  if (delegateHandler) {
    toolbarElement.removeEventListener('click', delegateHandler);
    delegateHandler = null;
  }

  if (hoverHandler) {
    toolbarElement.removeEventListener('mouseover', hoverHandler);
    hoverHandler = null;
  }

  if (leaveHandler) {
    toolbarElement.removeEventListener('mouseout', leaveHandler);
    leaveHandler = null;
  }

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
}
