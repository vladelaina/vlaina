// Floating Toolbar Plugin - Core Plugin Logic
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
  calculatePosition 
} from './selectionHelpers';
import { renderToolbarContent } from './renderToolbar';
import { toggleMark } from './commands';

export const floatingToolbarKey = new PluginKey<FloatingToolbarState>('floatingToolbar');

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
let updateDebounceTimer: ReturnType<typeof setTimeout> | null = null;
const UPDATE_DEBOUNCE_MS = 16; // ~60fps

// Create toolbar DOM structure
function createToolbarElement(): HTMLElement {
  const toolbar = document.createElement('div');
  toolbar.className = 'floating-toolbar';
  toolbar.setAttribute('role', 'toolbar');
  toolbar.setAttribute('aria-label', 'Text formatting');
  return toolbar;
}

// Update toolbar visibility with animation
function updateToolbarVisibility(
  visible: boolean, 
  position: { x: number; y: number }, 
  placement: 'top' | 'bottom'
) {
  if (!toolbarElement) return;

  if (visible) {
    toolbarElement.style.left = `${position.x}px`;
    toolbarElement.style.top = `${position.y}px`;
    toolbarElement.style.transform = `translateX(-50%) translateY(${placement === 'top' ? '-100%' : '0'})`;
    toolbarElement.classList.add('visible');
    toolbarElement.classList.remove('hidden');
  } else {
    toolbarElement.classList.remove('visible');
    toolbarElement.classList.add('hidden');
  }
}

// Main plugin export
export const floatingToolbarPlugin = $prose(() => {
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

        // Auto-update on selection change
        if (tr.selectionSet || tr.docChanged) {
          const { selection } = newState;
          const { empty } = selection;

          if (empty) {
            return { ...prevState, isVisible: false, subMenu: null };
          }

          return { ...prevState, isVisible: true };
        }

        return prevState;
      },
    },

    view(editorView) {
      // Create toolbar element
      toolbarElement = createToolbarElement();
      document.body.appendChild(toolbarElement);

      const updateToolbar = () => {
        const state = floatingToolbarKey.getState(editorView.state);
        if (!state) return;

        const { selection } = editorView.state;
        const { empty } = selection;

        if (empty || !state.isVisible) {
          updateToolbarVisibility(false, { x: 0, y: 0 }, 'top');
          return;
        }

        // Calculate position and gather state
        const { x, y, placement } = calculatePosition(editorView);
        const activeMarks = getActiveMarks(editorView);
        const currentBlockType = getCurrentBlockType(editorView);
        const linkUrl = getLinkUrl(editorView);
        const textColor = getTextColor(editorView);
        const bgColor = getBgColor(editorView);

        // Update toolbar content
        renderToolbarContent(toolbarElement!, editorView, {
          ...state,
          activeMarks,
          currentBlockType,
          linkUrl,
          textColor,
          bgColor,
        });

        updateToolbarVisibility(true, { x, y }, placement);
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

      // Debounced update for performance
      const debouncedUpdate = () => {
        if (updateDebounceTimer) {
          clearTimeout(updateDebounceTimer);
        }
        updateDebounceTimer = setTimeout(updateToolbar, UPDATE_DEBOUNCE_MS);
      };

      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);

      return {
        update: debouncedUpdate,
        destroy() {
          if (updateDebounceTimer) {
            clearTimeout(updateDebounceTimer);
            updateDebounceTimer = null;
          }
          document.removeEventListener('mousedown', handleClickOutside);
          document.removeEventListener('keydown', handleKeyDown);
          if (toolbarElement) {
            toolbarElement.remove();
            toolbarElement = null;
          }
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
