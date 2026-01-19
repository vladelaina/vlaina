// Toolbar Rendering Functions
// Handles DOM rendering and event binding for the floating toolbar

import type { EditorView } from '@milkdown/kit/prose/view';
import type { FloatingToolbarState, BlockType } from './types';
import { TOOLBAR_ACTIONS } from './types';
import { floatingToolbarKey } from './floatingToolbarPlugin';
import { toggleMark, setLink } from './commands';
import { renderBlockDropdown } from './components/BlockDropdown';
import { applyFormatPreview, clearFormatPreview, hasFormatPreview } from './previewStyles';
import { getLinkUrl } from './selectionHelpers';
import { linkTooltipPluginKey } from '../link-tooltip';

// ============================================================================
// Button Configuration
// ============================================================================

interface ToolbarButtonConfig {
  action: string;
  icon: string;
  tooltip: string;
  shortcut?: string;
  mark?: string;  // For checking active state
}

// SVG Icons
const ICONS = {
  bold: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
    <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path>
    <path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path>
  </svg>`,
  italic: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <line x1="19" y1="4" x2="10" y2="4"></line>
    <line x1="14" y1="20" x2="5" y2="20"></line>
    <line x1="15" y1="4" x2="9" y2="20"></line>
  </svg>`,
  underline: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"></path>
    <line x1="4" y1="21" x2="20" y2="21"></line>
  </svg>`,
  strike: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M17.3 4.9c-2.3-.6-4.4-1-6.2-.9-2.7 0-5.3.7-5.3 3.6 0 1.5 1.8 3.3 3.6 3.9h.2m8.2 3.7c.3.4.4.8.4 1.3 0 2.9-2.7 3.6-6.2 3.6-2.3 0-4.4-.3-6.2-.9M4 11.5h16"></path>
  </svg>`,
  code: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <polyline points="16 18 22 12 16 6"></polyline>
    <polyline points="8 6 2 12 8 18"></polyline>
  </svg>`,
  highlight: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="m9 11-6 6v3h9l3-3"></path>
    <path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"></path>
  </svg>`,
  link: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
  </svg>`,
  color: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="m4 21 1.9-5.7m0 0 3.1-9.3 3.1 9.3m-6.2 0h6.2m3.8 5.7 1.9-5.7m0 0 3.1-9.3 3.1 9.3m-6.2 0h6.2"></path>
  </svg>`,
  text: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M4 7V4h16v3M9 20h6M12 4v16"/>
  </svg>`,
  chevronDown: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <polyline points="6 9 12 15 18 9"></polyline>
  </svg>`,
};

// Format buttons configuration (first group)
const FORMAT_BUTTONS: ToolbarButtonConfig[] = [
  { action: 'bold', icon: ICONS.bold, tooltip: 'Bold', shortcut: 'Ctrl+B', mark: 'strong' },
  { action: 'italic', icon: ICONS.italic, tooltip: 'Italic', shortcut: 'Ctrl+I', mark: 'emphasis' },
  { action: 'underline', icon: ICONS.underline, tooltip: 'Underline', shortcut: 'Ctrl+U', mark: 'underline' },
  { action: 'strike', icon: ICONS.strike, tooltip: 'Strikethrough', shortcut: 'Ctrl+Shift+X', mark: 'strike_through' },
  { action: 'code', icon: ICONS.code, tooltip: 'Inline Code', shortcut: 'Ctrl+E', mark: 'inlineCode' },
  { action: 'highlight', icon: ICONS.highlight, tooltip: 'Highlight', shortcut: 'Ctrl+H', mark: 'highlight' },
];

// Extra buttons configuration (second group)
const EXTRA_BUTTONS: ToolbarButtonConfig[] = [
  { action: 'link', icon: ICONS.link, tooltip: 'Add Link', shortcut: 'Ctrl+K' },
  { action: 'color', icon: ICONS.color, tooltip: 'Text Color' },
];

// ============================================================================
// Button Rendering
// ============================================================================

/**
 * Render a single toolbar button
 */
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

/**
 * Render a group of buttons
 */
function renderButtonGroup(buttons: ToolbarButtonConfig[], activeMarks: Set<string>, extraClass?: string): string {
  const buttonsHtml = buttons.map(btn => renderButton(btn, activeMarks)).join('');
  return `<div class="toolbar-group ${extraClass || ''}">${buttonsHtml}</div>`;
}

// ============================================================================
// Block Type Helpers
// ============================================================================

/**
 * Get block type label for display (empty for paragraph since we use icon)
 */
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

/**
 * Render block type button content
 */
function renderBlockTypeContent(blockType: BlockType): string {
  if (blockType === 'paragraph') {
    return ICONS.text;
  }
  return `<span class="block-type-label">${getBlockTypeLabel(blockType)}</span>`;
}

// ============================================================================
// Action Handlers
// ============================================================================

/**
 * Handle toolbar button actions
 */
function handleToolbarAction(view: EditorView, action: string, state: FloatingToolbarState) {
  // Mark toggle actions
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


  // Link toggle action
  if (action === 'link') {
    const linkUrl = getLinkUrl(view);

    // Case 1: Link exists with a real URL - remove it
    if (linkUrl !== null && linkUrl !== '') {
      setLink(view, null);
      return;
    }

    // Case 2: Link exists but URL is empty - just show tooltip
    if (linkUrl === '') {
      const { state, dispatch } = view;
      const { from, to } = state.selection;
      // Just dispatch the meta to show tooltip, don't add mark again
      const tr = state.tr.setMeta(linkTooltipPluginKey, { type: 'SHOW_LINK_TOOLTIP', from, to });
      dispatch(tr);
      view.focus();
      return;
    }

    // Case 3: No link exists - create new empty link and show tooltip
    const { state, dispatch } = view;
    const { from, to } = state.selection;

    // Just show the tooltip without adding a mark yet
    // The mark will be added when the user saves the link in the tooltip
    const tr = state.tr.setMeta(linkTooltipPluginKey, { type: 'SHOW_LINK_TOOLTIP', from, to });
    dispatch(tr);
    view.focus();

    return;
  }

  // Sub-menu toggle actions
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

// ============================================================================
// Tooltip System
// ============================================================================

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

// ============================================================================
// Event Delegation
// ============================================================================

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
    // Click handler
    delegateHandler = (e: Event) => {
      const target = e.target as HTMLElement;
      const button = target.closest('[data-action]') as HTMLElement | null;

      if (button && currentView && currentState) {
        e.preventDefault();
        e.stopPropagation();

        // Clear preview before applying
        clearFormatPreview(currentView);

        const action = button.dataset.action;
        if (action) {
          handleToolbarAction(currentView, action, currentState);
        }
      }
    };

    // Hover handler
    hoverHandler = (e: Event) => {
      const target = e.target as HTMLElement;
      const button = target.closest('[data-action]') as HTMLElement | null;

      if (button && currentView) {
        const action = button.dataset.action;

        // Apply format preview only for inactive formats
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

    // Leave handler
    leaveHandler = (e: Event) => {
      const mouseEvent = e as MouseEvent;
      const target = e.target as HTMLElement;
      const button = target.closest('[data-action]') as HTMLElement | null;

      if (button && currentView) {
        const relatedTarget = mouseEvent.relatedTarget as HTMLElement | null;
        if (relatedTarget && button.contains(relatedTarget)) {
          return;
        }

        // Clear format preview
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

// ============================================================================
// Main Render Function
// ============================================================================

export function renderToolbarContent(
  toolbarElement: HTMLElement,
  view: EditorView,
  state: FloatingToolbarState
) {
  updateToolbarState(view, state);

  if (!delegateHandler) {
    setupToolbarEventDelegation(toolbarElement, view, state);
  }

  // Render color button with indicator
  const colorButton = renderButton(EXTRA_BUTTONS[1], state.activeMarks,
    state.textColor ? `<span class="color-indicator" style="background-color: ${state.textColor}"></span>` : ''
  );

  // Render block type button
  const blockButtonActive = state.subMenu === 'block' ? 'active' : '';
  const blockButton = `
    <button class="toolbar-btn toolbar-dropdown-btn has-tooltip ${blockButtonActive}" 
            data-action="block" 
            data-tooltip="Text Type">
      ${renderBlockTypeContent(state.currentBlockType)}
      ${ICONS.chevronDown}
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
    </div>
  `;

  // Render block dropdown if needed
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
