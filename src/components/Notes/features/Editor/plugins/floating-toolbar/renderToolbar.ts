import type { EditorView } from '@milkdown/kit/prose/view';
import type { FloatingToolbarState, BlockType } from './types';
import { TOOLBAR_ACTIONS } from './types';
import { floatingToolbarKey } from './floatingToolbarPlugin';
import { toggleMark, setLink } from './commands';
import { renderBlockDropdown } from './components/BlockDropdown';
import { applyFormatPreview, clearFormatPreview, hasFormatPreview } from './previewStyles';
import { getLinkUrl } from './selectionHelpers';
import { linkTooltipPluginKey } from '../links';

import { EDITOR_ICONS } from '@/components/ui/icons/editor-svgs';

interface ToolbarButtonConfig {
  action: string;
  icon: string;
  tooltip: string;
  shortcut?: string;
  mark?: string;
}

const FORMAT_BUTTONS: ToolbarButtonConfig[] = [
  { action: 'bold', icon: EDITOR_ICONS.bold, tooltip: 'Bold', shortcut: 'Ctrl+B', mark: 'strong' },
  { action: 'italic', icon: EDITOR_ICONS.italic, tooltip: 'Italic', shortcut: 'Ctrl+I', mark: 'emphasis' },
  { action: 'underline', icon: EDITOR_ICONS.underline, tooltip: 'Underline', shortcut: 'Ctrl+U', mark: 'underline' },
  { action: 'strike', icon: EDITOR_ICONS.strike, tooltip: 'Strikethrough', shortcut: 'Ctrl+Shift+X', mark: 'strike_through' },
  { action: 'code', icon: EDITOR_ICONS.code, tooltip: 'Inline Code', shortcut: 'Ctrl+E', mark: 'inlineCode' },
  { action: 'highlight', icon: EDITOR_ICONS.highlight, tooltip: 'Highlight', shortcut: 'Ctrl+H', mark: 'highlight' },
];

const EXTRA_BUTTONS: ToolbarButtonConfig[] = [
  { action: 'link', icon: EDITOR_ICONS.link, tooltip: 'Add Link', shortcut: 'Ctrl+K' },
  { action: 'color', icon: EDITOR_ICONS.color, tooltip: 'Text Color' },
  { action: 'delete', icon: EDITOR_ICONS.trash, tooltip: 'Delete' },
];

function renderButton(config: ToolbarButtonConfig, activeMarks: Set<string>, extraContent?: string): string {
  const isActive = config.mark && activeMarks.has(config.mark);
  const shortcutAttr = config.shortcut ? `data-shortcut="${config.shortcut}"` : '';

  return `
    <button class="toolbar-btn has-tooltip ${isActive ? 'active' : ''}" 
            data-action="${config.action}" 
            data-tooltip="${config.tooltip}"
            ${shortcutAttr}>
      ${config.icon}
      ${extraContent || ''}
    </button>
  `;
}

function renderButtonGroup(buttons: ToolbarButtonConfig[], activeMarks: Set<string>, extraClass?: string): string {
  const buttonsHtml = buttons.map(btn => renderButton(btn, activeMarks)).join('');
  return `<div class="toolbar-group ${extraClass || ''}">${buttonsHtml}</div>`;
}

function getBlockTypeLabel(blockType: BlockType): string {
  const labels: Record<BlockType, string> = {
    paragraph: '',
    heading1: 'H1',
    heading2: 'H2',
    heading3: 'H3',
    heading4: 'H4',
    heading5: 'H5',
    heading6: 'H6',
    blockquote: 'Quote',
    bulletList: 'Bullet',
    orderedList: 'Number',
    taskList: 'Task',
    codeBlock: 'Code',
  };
  return labels[blockType] || '';
}

function renderBlockTypeContent(blockType: BlockType): string {
  if (blockType === 'paragraph') {
    return EDITOR_ICONS.text;
  }
  return `<span class="block-type-label">${getBlockTypeLabel(blockType)}</span>`;
}

function handleToolbarAction(view: EditorView, action: string, state: FloatingToolbarState) {
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

    if (linkUrl === '') {
      const { state, dispatch } = view;
      const { from, to } = state.selection;
      const tr = state.tr.setMeta(linkTooltipPluginKey, { type: 'SHOW_LINK_TOOLTIP', from, to });
      dispatch(tr);
      view.focus();
      return;
    }

    const { state, dispatch } = view;
    const { from, to } = state.selection;

    const tr = state.tr.setMeta(linkTooltipPluginKey, { type: 'SHOW_LINK_TOOLTIP', from, to });
    dispatch(tr);
    view.focus();

    return;
  }

  if (action === 'delete') {
    const { state, dispatch } = view;
    const { from, to } = state.selection;
    if (from < to) {
      const tr = state.tr.delete(from, to);
      dispatch(tr);
    }
    view.focus();
    return;
  }

  const subMenuActions = ['color', 'block'];
  if (subMenuActions.includes(action)) {
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
  const text = button.dataset.tooltip;
  const shortcut = button.dataset.shortcut;

  if (!text) return;

  let html = `<span class="toolbar-tooltip-text">${text}</span>`;
  if (shortcut) {
    const keys = shortcut.split('+').map(k => `<kbd>${k}</kbd>`).join('');
    html += `<span class="toolbar-tooltip-shortcut">${keys}</span>`;
  }
  tooltip.innerHTML = html;

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

  if (!delegateHandler) {
    delegateHandler = (e: Event) => {
      const target = e.target as HTMLElement;
      const button = target.closest('[data-action]') as HTMLElement | null;

      if (button && currentView && currentState) {
        e.preventDefault();
        e.stopPropagation();

        clearFormatPreview(currentView);

        const action = button.dataset.action;
        if (action) {
          handleToolbarAction(currentView, action, currentState);
        }
      }
    };

    hoverHandler = (e: Event) => {
      const target = e.target as HTMLElement;
      const button = target.closest('[data-action]') as HTMLElement | null;

      if (button && currentView) {
        const action = button.dataset.action;

        const isActive = button.classList.contains('active');
        if (action && hasFormatPreview(action) && !isActive) {
          applyFormatPreview(currentView, action, false);
        }

        if (button.dataset.tooltip) {
          hideTooltip();
          tooltipTimer = setTimeout(() => showTooltip(button), 500);
        }
      }
    };

    leaveHandler = (e: Event) => {
      const mouseEvent = e as MouseEvent;
      const target = e.target as HTMLElement;
      const button = target.closest('[data-action]') as HTMLElement | null;

      if (button && currentView) {
        const relatedTarget = mouseEvent.relatedTarget as HTMLElement | null;
        if (relatedTarget && button.contains(relatedTarget)) {
          return;
        }

        const action = button.dataset.action;
        if (action && hasFormatPreview(action)) {
          clearFormatPreview(currentView);
        }

        hideTooltip();
      }
    };

    toolbarElement.addEventListener('click', delegateHandler);
    toolbarElement.addEventListener('mouseover', hoverHandler);
    toolbarElement.addEventListener('mouseout', leaveHandler);
  }
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
  if (tooltipElement) {
    tooltipElement.remove();
    tooltipElement = null;
  }
  currentView = null;
  currentState = null;
}

export function renderToolbarContent(
  toolbarElement: HTMLElement,
  view: EditorView,
  state: FloatingToolbarState
) {
  updateToolbarState(view, state);

  if (!delegateHandler) {
    setupToolbarEventDelegation(toolbarElement, view, state);
  }

  const colorButton = renderButton(EXTRA_BUTTONS[1], state.activeMarks,
    state.textColor ? `<span class="color-indicator" style="background-color: ${state.textColor}"></span>` : ''
  );

  const blockButtonActive = state.subMenu === 'block' ? 'active' : '';
  const blockButton = `
    <button class="toolbar-btn toolbar-dropdown-btn has-tooltip ${blockButtonActive}" 
            data-action="block" 
            data-tooltip="Text Type">
      ${renderBlockTypeContent(state.currentBlockType)}
      ${EDITOR_ICONS.chevronDown}
    </button>
  `;

  toolbarElement.innerHTML = `
    <div class="floating-toolbar-inner">
      ${renderButtonGroup(FORMAT_BUTTONS, state.activeMarks, 'toolbar-format-group')}
      <div class="toolbar-divider"></div>
      <div class="toolbar-group">
        ${renderButton(EXTRA_BUTTONS[0], state.activeMarks)}
        ${colorButton}
      </div>
      <div class="toolbar-divider"></div>
      <div class="toolbar-group toolbar-block-group">
        ${blockButton}
      </div>
      <div class="toolbar-divider"></div>
      <div class="toolbar-group">
        ${renderButton(EXTRA_BUTTONS[2], state.activeMarks)}
      </div>
    </div>
  `;

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
}