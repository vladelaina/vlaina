// Floating Toolbar Plugin - Core Plugin Logic
// Optimized for performance - only updates when selection is non-empty

import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import type { FloatingToolbarState, ToolbarMeta } from './types';
import { TOOLBAR_ACTIONS } from './types';
import { 
  getActiveMarks, 
  getCurrentBlockType, 
  getLinkUrl, 
  getTextColor, 
  getBgColor, 
  calculatePosition,
  isSelectionInFirstH1 
} from './selectionHelpers';
import { renderToolbarContent } from './renderToolbar';
import { toggleMark } from './commands';

export const floatingToolbarKey = new PluginKey<FloatingToolbarState>('floatingToolbar');

// Store the current block element for preview functionality
let currentBlockElement: HTMLElement | null = null;

/**
 * Get the current block element (for preview in dropdown)
 */
export function getCurrentBlockElement(): HTMLElement | null {
  return currentBlockElement;
}

/**
 * Find and store the block element from selection
 */
function updateCurrentBlockElement(view: { state: { selection: { $from: any } }; domAtPos: (pos: number) => { node: Node } }): void {
  try {
    const { $from } = view.state.selection;
    const domAtPos = view.domAtPos($from.pos);
    let node = domAtPos.node as Node;
    
    if (node.nodeType === Node.TEXT_NODE) {
      node = node.parentNode as Node;
    }
    
    let el = node as HTMLElement;
    while (el && el.parentElement) {
      const tagName = el.tagName?.toUpperCase();
      if (tagName === 'P' || (tagName && /^H[1-6]$/.test(tagName))) {
        currentBlockElement = el;
        return;
      }
      if (el.classList?.contains('milkdown') || el.classList?.contains('editor')) {
        break;
      }
      el = el.parentElement;
    }
    currentBlockElement = null;
  } catch {
    currentBlockElement = null;
  }
}

// Initial state factory
function createInitialState(): FloatingToolbarState {
  return {
    isVisible: false,
    position: { x: 0, y: 0 },
    placement: 'top',
    activeMarks: new Set(),
    currentBlockType: 'paragraph',
    linkUrl: null,
    textColor: null,
    bgColor: null,
    subMenu: null,
  };
}

// Toolbar DOM element reference
let toolbarElement: HTMLElement | null = null;
let lastRenderState: string = '';

// Create toolbar DOM structure
function createToolbarElement(): HTMLElement {
  const toolbar = document.createElement('div');
  toolbar.className = 'floating-toolbar hidden';
  toolbar.setAttribute('role', 'toolbar');
  toolbar.setAttribute('aria-label', 'Text formatting');
  return toolbar;
}

// Update toolbar visibility
function showToolbar(position: { x: number; y: number }, placement: 'top' | 'bottom') {
  if (!toolbarElement) return;
  toolbarElement.style.left = `${position.x}px`;
  toolbarElement.style.top = `${position.y}px`;
  toolbarElement.style.transform = `translateX(-50%) translateY(${placement === 'top' ? '-100%' : '0'})`;
  toolbarElement.classList.add('visible');
  toolbarElement.classList.remove('hidden');
}

function hideToolbar() {
  if (!toolbarElement) return;
  toolbarElement.classList.remove('visible');
  toolbarElement.classList.add('hidden');
}

// Main plugin export
export const floatingToolbarPlugin = $prose(() => {
  // Track mouse state to show toolbar only on mouseup
  let isMouseDown = false;
  let pendingShow = false;
  
  return new Plugin<FloatingToolbarState>({
    key: floatingToolbarKey,

    state: {
      init: () => createInitialState(),
      apply(tr, prevState, _oldState, newState) {
        const meta = tr.getMeta(floatingToolbarKey) as ToolbarMeta | undefined;

        if (meta) {
          switch (meta.type) {
            case TOOLBAR_ACTIONS.SHOW:
              return { ...prevState, isVisible: true, ...meta.payload };
            case TOOLBAR_ACTIONS.HIDE:
              return { ...prevState, isVisible: false, subMenu: null };
            case TOOLBAR_ACTIONS.UPDATE_POSITION:
              return { ...prevState, ...meta.payload };
            case TOOLBAR_ACTIONS.SET_SUB_MENU:
              return { ...prevState, subMenu: meta.payload?.subMenu ?? null };
            default:
              return { ...prevState, ...meta.payload };
          }
        }

        // Only update visibility on selection change
        if (tr.selectionSet) {
          const { selection } = newState;
          if (selection.empty) {
            if (prevState.isVisible) {
              return { ...prevState, isVisible: false, subMenu: null };
            }
          } else {
            // Don't show immediately during mouse drag - wait for mouseup
            if (!isMouseDown && !prevState.isVisible) {
              return { ...prevState, isVisible: true };
            }
            // Mark that we should show on mouseup
            if (isMouseDown) {
              pendingShow = true;
            }
          }
        }

        return prevState;
      },
    },

    view(editorView) {
      toolbarElement = createToolbarElement();
      document.body.appendChild(toolbarElement);
      
      // Track mouse state
      const handleMouseDown = () => {
        isMouseDown = true;
        pendingShow = false;
      };
      
      const handleMouseUp = () => {
        isMouseDown = false;
        // Show toolbar if we have a pending selection
        if (pendingShow) {
          pendingShow = false;
          const { selection } = editorView.state;
          if (!selection.empty) {
            editorView.dispatch(
              editorView.state.tr.setMeta(floatingToolbarKey, {
                type: TOOLBAR_ACTIONS.SHOW,
              })
            );
          }
        }
      };
      
      document.addEventListener('mousedown', handleMouseDown);
      document.addEventListener('mouseup', handleMouseUp);

      const updateToolbar = () => {
        const { selection } = editorView.state;
        
        // Fast path: no selection = hide toolbar immediately
        if (selection.empty) {
          hideToolbar();
          lastRenderState = '';
          currentBlockElement = null;
          return;
        }
        
        // Don't show toolbar when selection is in the first H1 (document title)
        if (isSelectionInFirstH1(editorView)) {
          hideToolbar();
          lastRenderState = '';
          currentBlockElement = null;
          return;
        }
        
        // Update the current block element reference for preview
        updateCurrentBlockElement(editorView);

        const state = floatingToolbarKey.getState(editorView.state);
        if (!state?.isVisible) {
          hideToolbar();
          lastRenderState = '';
          return;
        }

        // Calculate position and gather state
        const { x, y, placement } = calculatePosition(editorView);
        const activeMarks = getActiveMarks(editorView);
        const currentBlockType = getCurrentBlockType(editorView);
        const linkUrl = getLinkUrl(editorView);
        const textColor = getTextColor(editorView);
        const bgColor = getBgColor(editorView);

        // Create a cache key to avoid unnecessary re-renders
        const cacheKey = [
          Array.from(activeMarks).sort().join(','),
          currentBlockType,
          linkUrl || '',
          textColor || '',
          bgColor || '',
          state.subMenu || ''
        ].join('|');

        // Only re-render if state changed
        if (cacheKey !== lastRenderState) {
          lastRenderState = cacheKey;
          renderToolbarContent(toolbarElement!, editorView, {
            ...state,
            activeMarks,
            currentBlockType,
            linkUrl,
            textColor,
            bgColor,
          });
        }

        showToolbar({ x, y }, placement);
      };

      // Handle click outside
      const handleClickOutside = (e: MouseEvent) => {
        if (toolbarElement && !toolbarElement.contains(e.target as Node)) {
          const state = floatingToolbarKey.getState(editorView.state);
          if (state?.subMenu) {
            editorView.dispatch(
              editorView.state.tr.setMeta(floatingToolbarKey, {
                type: TOOLBAR_ACTIONS.SET_SUB_MENU,
                payload: { subMenu: null },
              })
            );
          }
        }
      };

      // Handle escape key
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          const state = floatingToolbarKey.getState(editorView.state);
          if (state?.isVisible) {
            editorView.dispatch(
              editorView.state.tr.setMeta(floatingToolbarKey, {
                type: TOOLBAR_ACTIONS.HIDE,
              })
            );
          }
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);

      return {
        update: updateToolbar,
        destroy() {
          document.removeEventListener('mousedown', handleMouseDown);
          document.removeEventListener('mouseup', handleMouseUp);
          document.removeEventListener('mousedown', handleClickOutside);
          document.removeEventListener('keydown', handleKeyDown);
          if (toolbarElement) {
            toolbarElement.remove();
            toolbarElement = null;
          }
          lastRenderState = '';
          isMouseDown = false;
          pendingShow = false;
        },
      };
    },

    props: {
      handleKeyDown(view, event) {
        const isMod = event.ctrlKey || event.metaKey;

        if (isMod && !event.shiftKey) {
          const { selection } = view.state;
          if (selection.empty) return false;

          switch (event.key.toLowerCase()) {
            case 'b':
              event.preventDefault();
              toggleMark(view, 'strong');
              return true;
            case 'i':
              event.preventDefault();
              toggleMark(view, 'emphasis');
              return true;
            case 'u':
              event.preventDefault();
              toggleMark(view, 'underline');
              return true;
            case 'k':
              event.preventDefault();
              view.dispatch(
                view.state.tr.setMeta(floatingToolbarKey, {
                  type: TOOLBAR_ACTIONS.SET_SUB_MENU,
                  payload: { subMenu: 'link' },
                })
              );
              return true;
          }
        }

        return false;
      },
    },
  });
});
