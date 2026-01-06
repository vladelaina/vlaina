// Toolbar Rendering Functions
// Handles DOM rendering and event binding for the floating toolbar

import type { EditorView } from '@milkdown/kit/prose/view';
import type { FloatingToolbarState, BlockType } from './types';
import { TOOLBAR_ACTIONS } from './types';
import { floatingToolbarKey } from './floatingToolbarPlugin';
import { toggleMark } from './commands';

/**
 * Get block type label for display
 */
function getBlockTypeLabel(blockType: BlockType): string {
  const labels: Record<BlockType, string> = {
    paragraph: 'Text',
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
  return labels[blockType] || 'Text';
}

/**
 * Handle toolbar button actions
 */
function handleToolbarAction(view: EditorView, action: string, state: FloatingToolbarState) {
  switch (action) {
    case 'bold':
      toggleMark(view, 'strong');
      break;
    case 'italic':
      toggleMark(view, 'emphasis');
      break;
    case 'underline':
      toggleMark(view, 'underline');
      break;
    case 'strike':
      toggleMark(view, 'strike_through');
      break;
    case 'code':
      toggleMark(view, 'inlineCode');
      break;
    case 'highlight':
      toggleMark(view, 'highlight');
      break;
    case 'link':
      view.dispatch(
        view.state.tr.setMeta(floatingToolbarKey, {
          type: TOOLBAR_ACTIONS.SET_SUB_MENU,
          payload: { subMenu: state.subMenu === 'link' ? null : 'link' },
        })
      );
      break;
    case 'color':
      view.dispatch(
        view.state.tr.setMeta(floatingToolbarKey, {
          type: TOOLBAR_ACTIONS.SET_SUB_MENU,
          payload: { subMenu: state.subMenu === 'color' ? null : 'color' },
        })
      );
      break;
    case 'block':
      view.dispatch(
        view.state.tr.setMeta(floatingToolbarKey, {
          type: TOOLBAR_ACTIONS.SET_SUB_MENU,
          payload: { subMenu: state.subMenu === 'block' ? null : 'block' },
        })
      );
      break;
  }
}

// Cache for event delegation - avoid re-binding
let currentView: EditorView | null = null;
let currentState: FloatingToolbarState | null = null;
let delegateHandler: ((e: Event) => void) | null = null;

/**
 * Setup event delegation on toolbar element (called once)
 */
export function setupToolbarEventDelegation(
  toolbarElement: HTMLElement,
  view: EditorView,
  state: FloatingToolbarState
) {
  // Update cached references
  currentView = view;
  currentState = state;
  
  // Only attach handler once
  if (!delegateHandler) {
    delegateHandler = (e: Event) => {
      const target = e.target as HTMLElement;
      const button = target.closest('[data-action]') as HTMLElement | null;
      
      if (button && currentView && currentState) {
        e.preventDefault();
        e.stopPropagation();
        const action = button.dataset.action;
        if (action) {
          handleToolbarAction(currentView, action, currentState);
        }
      }
    };
    
    toolbarElement.addEventListener('click', delegateHandler);
  }
}

/**
 * Update cached state for event delegation
 */
export function updateToolbarState(view: EditorView, state: FloatingToolbarState) {
  currentView = view;
  currentState = state;
}

/**
 * Cleanup event delegation
 */
export function cleanupToolbarEventDelegation(toolbarElement: HTMLElement) {
  if (delegateHandler) {
    toolbarElement.removeEventListener('click', delegateHandler);
    delegateHandler = null;
  }
  currentView = null;
  currentState = null;
}

/**
 * Render toolbar content into the toolbar element
 * Uses event delegation instead of per-button listeners
 */
export function renderToolbarContent(
  toolbarElement: HTMLElement,
  view: EditorView, 
  state: FloatingToolbarState
) {
  // Update state for event delegation
  updateToolbarState(view, state);
  
  // Setup delegation if not already done
  if (!delegateHandler) {
    setupToolbarEventDelegation(toolbarElement, view, state);
  }
  
  toolbarElement.innerHTML = `
    <div class="floating-toolbar-inner">
      <div class="toolbar-group toolbar-format-group">
        <button class="toolbar-btn ${state.activeMarks.has('strong') ? 'active' : ''}" data-action="bold" title="Bold (Ctrl+B)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path>
            <path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path>
          </svg>
        </button>
        <button class="toolbar-btn ${state.activeMarks.has('emphasis') ? 'active' : ''}" data-action="italic" title="Italic (Ctrl+I)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="19" y1="4" x2="10" y2="4"></line>
            <line x1="14" y1="20" x2="5" y2="20"></line>
            <line x1="15" y1="4" x2="9" y2="20"></line>
          </svg>
        </button>
        <button class="toolbar-btn ${state.activeMarks.has('underline') ? 'active' : ''}" data-action="underline" title="Underline (Ctrl+U)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"></path>
            <line x1="4" y1="21" x2="20" y2="21"></line>
          </svg>
        </button>
        <button class="toolbar-btn ${state.activeMarks.has('strike_through') ? 'active' : ''}" data-action="strike" title="Strikethrough">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17.3 4.9c-2.3-.6-4.4-1-6.2-.9-2.7 0-5.3.7-5.3 3.6 0 1.5 1.8 3.3 3.6 3.9h.2m8.2 3.7c.3.4.4.8.4 1.3 0 2.9-2.7 3.6-6.2 3.6-2.3 0-4.4-.3-6.2-.9M4 11.5h16"></path>
          </svg>
        </button>
        <button class="toolbar-btn ${state.activeMarks.has('inlineCode') ? 'active' : ''}" data-action="code" title="Inline Code">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="16 18 22 12 16 6"></polyline>
            <polyline points="8 6 2 12 8 18"></polyline>
          </svg>
        </button>
        <button class="toolbar-btn ${state.activeMarks.has('highlight') ? 'active' : ''}" data-action="highlight" title="Highlight">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="m9 11-6 6v3h9l3-3"></path>
            <path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"></path>
          </svg>
        </button>
      </div>
      <div class="toolbar-divider"></div>
      <div class="toolbar-group">
        <button class="toolbar-btn" data-action="link" title="Add Link (Ctrl+K)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
          </svg>
        </button>
        <button class="toolbar-btn" data-action="color" title="Text Color">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="m4 21 1.9-5.7m0 0 3.1-9.3 3.1 9.3m-6.2 0h6.2m3.8 5.7 1.9-5.7m0 0 3.1-9.3 3.1 9.3m-6.2 0h6.2"></path>
          </svg>
          ${state.textColor ? `<span class="color-indicator" style="background-color: ${state.textColor}"></span>` : ''}
        </button>
      </div>
      <div class="toolbar-divider"></div>
      <div class="toolbar-group">
        <button class="toolbar-btn toolbar-dropdown-btn" data-action="block" title="Block Type">
          <span class="block-type-label">${getBlockTypeLabel(state.currentBlockType)}</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
      </div>
    </div>
    <div class="toolbar-arrow"></div>
  `;
}
