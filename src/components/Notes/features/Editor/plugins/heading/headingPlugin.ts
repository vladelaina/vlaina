import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey, TextSelection } from '@milkdown/kit/prose/state';
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view';

// ============================================================================
// State & Types
// ============================================================================

interface HeadingPluginState {
  hoveredPos: number | null;
  activeMenuPos: number | null;
  previewLevel: number | null;
}

const ACTIONS = {
  SET_HOVER: 'SET_HOVER',
  SET_MENU: 'SET_MENU',
  SET_PREVIEW: 'SET_PREVIEW',
};

const pluginKey = new PluginKey<HeadingPluginState>('headingPlugin');

// ============================================================================
// Helpers
// ============================================================================

function isFirstH1(doc: any, pos: number): boolean {
  const firstNode = doc.firstChild;
  return (
    firstNode !== null && 
    pos === 0 && 
    firstNode.type.name === 'heading' && 
    firstNode.attrs.level === 1
  );
}

let closeCurrentMenu: (() => void) | null = null;

function createLevelMenu(view: any, pos: number, currentLevel: number, rect: DOMRect) {
  if (closeCurrentMenu) closeCurrentMenu();

  const menu = document.createElement('div');
  menu.className = 'heading-level-menu';
  Object.assign(menu.style, {
    position: 'fixed',
    left: `${rect.left}px`,
    top: `${rect.bottom + 4}px`,
  });
  
  for (let level = 1; level <= 6; level++) {
    const item = document.createElement('button');
    item.className = `heading-level-item${level === currentLevel ? ' active' : ''}`;
    item.textContent = `${'#'.repeat(level)} Heading ${level}`;
    
    // Preview interaction
    item.onmouseenter = () => {
      view.dispatch(view.state.tr.setMeta(pluginKey, { type: ACTIONS.SET_PREVIEW, level }));
    };

    item.onmouseleave = () => {
      view.dispatch(view.state.tr.setMeta(pluginKey, { type: ACTIONS.SET_PREVIEW, level: null }));
    };

    // Apply interaction
    item.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Clear preview immediately to avoid flash
      let tr = view.state.tr.setMeta(pluginKey, { type: ACTIONS.SET_PREVIEW, level: null });

      if (level !== currentLevel) {
        tr = tr.setNodeMarkup(pos, undefined, { level });
      }
      
      view.dispatch(tr);
      closeMenuAndState();
      view.focus();
    };
    
    menu.appendChild(item);
  }
  
  document.body.appendChild(menu);

  const closeMenuAndState = () => {
    if (document.body.contains(menu)) menu.remove();
    closeCurrentMenu = null;
    
    if (!view.isDestroyed) {
      view.dispatch(view.state.tr.setMeta(pluginKey, { type: ACTIONS.SET_MENU, pos: null }));
    }
  };

  closeCurrentMenu = closeMenuAndState;

  const handleClickOutside = (e: MouseEvent) => {
    if (!menu.contains(e.target as Node)) {
      closeMenuAndState();
      document.removeEventListener('click', handleClickOutside);
    }
  };
  
  setTimeout(() => document.addEventListener('click', handleClickOutside), 0);
}

// ============================================================================
// Plugins
// ============================================================================

/**
 * Prevents deletion of the document title (First H1).
 */
const protectFirstH1Plugin = $prose(() => {
  return new Plugin({
    key: new PluginKey('protectFirstH1'),
    props: {
      handleKeyDown(view, event) {
        const { selection, doc } = view.state;
        const { from, empty } = selection;
        const firstNode = doc.firstChild;
        
        if (!firstNode || firstNode.type.name !== 'heading') return false;
        if (event.key === 'Backspace' && empty && from === 1) return true;
        
        return false;
      }
    }
  });
});

/**
 * Handles the editable hash marks (##), the hover widget, and the real-time preview decorations.
 */
const headingHashPlugin = $prose(() => {
  let editingHeadingPos: number | null = null;
  let isProcessingTransaction = false;

  return new Plugin<HeadingPluginState>({
    key: pluginKey,
    
    state: {
      init: () => ({ hoveredPos: null, activeMenuPos: null, previewLevel: null }),
      apply(tr, value) {
        const meta = tr.getMeta(pluginKey);
        if (!meta) return value;
        
        switch (meta.type) {
          case ACTIONS.SET_HOVER: return { ...value, hoveredPos: meta.pos };
          case ACTIONS.SET_MENU: return { ...value, activeMenuPos: meta.pos, previewLevel: null };
          case ACTIONS.SET_PREVIEW: return { ...value, previewLevel: meta.level };
          default: return value;
        }
      }
    },

    view() {
      return {
        update(view, prevState) {
          if (isProcessingTransaction) return;

          const { selection, doc } = view.state;
          const $from = selection.$from;

          // Check if cursor is inside a heading
          let currentHeadingPos: number | null = null;
          if ($from.parent.type.name === 'heading') {
            const pos = $from.before($from.depth);
            if (!isFirstH1(doc, pos)) currentHeadingPos = pos;
          }

          // Logic to show/hide the editable "## " text based on cursor position
          if (currentHeadingPos !== null && editingHeadingPos === null) {
            const node = doc.nodeAt(currentHeadingPos);
            if (node && node.type.name === 'heading') {
              const level = node.attrs.level as number;
              const hashPrefix = '#'.repeat(level) + ' ';
              
              if (!node.textContent.startsWith(hashPrefix)) {
                isProcessingTransaction = true;
                const tr = view.state.tr.insertText(hashPrefix, currentHeadingPos + 1);
                // Adjust cursor to stay after the inserted hashes
                tr.setSelection(TextSelection.create(tr.doc, $from.pos + hashPrefix.length));
                view.dispatch(tr);
                editingHeadingPos = currentHeadingPos;
                isProcessingTransaction = false;
              } else {
                editingHeadingPos = currentHeadingPos;
              }
            }
          } else if (editingHeadingPos !== null && currentHeadingPos !== editingHeadingPos) {
            const oldPos = editingHeadingPos;
            const nodeNow = doc.nodeAt(oldPos);
            
            if (nodeNow && nodeNow.type.name === 'heading') {
               const hashMatch = nodeNow.textContent.match(/^(#{1,6})\s*/);
               if (hashMatch) {
                 isProcessingTransaction = true;
                 const hashCount = hashMatch[1].length;
                 let tr = view.state.tr.delete(oldPos + 1, oldPos + 1 + hashMatch[0].length);
                 
                 // Update level if user changed hash count manually
                 if (hashCount !== nodeNow.attrs.level) {
                   tr = tr.setNodeMarkup(oldPos, undefined, { level: hashCount });
                 }
                 
                 view.dispatch(tr);
                 isProcessingTransaction = false;
               }
            }
            editingHeadingPos = null;
            // Ensure next update cycle catches the entry if we moved directly to another heading
            if (currentHeadingPos !== null) {
              setTimeout(() => { if (!view.isDestroyed) view.updateState(view.state); }, 0);
            }
          }
        },
        destroy() {
          if (closeCurrentMenu) closeCurrentMenu();
        }
      };
    },

    props: {
      decorations(state) {
        const { doc } = state;
        const pluginState = pluginKey.getState(state);
        if (!pluginState) return DecorationSet.empty;
        
        const { hoveredPos, activeMenuPos, previewLevel } = pluginState;
        const decorations: Decoration[] = [];

        // 1. Hover/Menu Widget (The clickable "#")
        const targetPos = activeMenuPos !== null ? activeMenuPos : hoveredPos;
        if (targetPos !== null && targetPos !== editingHeadingPos) {
          const node = doc.nodeAt(targetPos);
          if (node && node.type.name === 'heading' && !isFirstH1(doc, targetPos)) {
            const level = node.attrs.level as number;
            const hashes = '#'.repeat(level) + ' ';
            const className = activeMenuPos === targetPos ? 'heading-hash-hover heading-hash-active' : 'heading-hash-hover';
            
            decorations.push(Decoration.widget(targetPos + 1, (view) => {
              const span = document.createElement('span');
              span.textContent = hashes;
              span.className = className;
              span.onclick = (e) => {
                e.preventDefault(); e.stopPropagation();
                const rect = span.getBoundingClientRect();
                view.dispatch(view.state.tr.setMeta(pluginKey, { type: ACTIONS.SET_MENU, pos: targetPos }));
                createLevelMenu(view, targetPos, level, rect);
              };
              return span;
            }, { side: -1, key: `heading-hash-${targetPos}` }));
          }
        }

        // 2. Real-time Preview (Applies shared CSS classes)
        if (activeMenuPos !== null && previewLevel !== null) {
          const node = doc.nodeAt(activeMenuPos);
          if (node && node.type.name === 'heading') {
            const previewClass = `heading-preview-${previewLevel}`;
            
            // Decoration on the container (handles margins/block layout)
            decorations.push(Decoration.node(activeMenuPos, activeMenuPos + node.nodeSize, {
              class: previewClass
            }));

            // Decoration on the inline text (handles fonts/colors)
            if (node.content.size > 0) {
              decorations.push(Decoration.inline(activeMenuPos + 1, activeMenuPos + node.nodeSize - 1, {
                class: previewClass
              }));
            }
          }
        }

        // 3. Edit Mode Styling (Gray out hashes)
        if (editingHeadingPos !== null) {
          const node = doc.nodeAt(editingHeadingPos);
          if (node && node.type.name === 'heading') {
             const hashMatch = node.textContent.match(/^(#{1,6})\s*/);
             if (hashMatch) {
               decorations.push(Decoration.inline(editingHeadingPos + 1, editingHeadingPos + 1 + hashMatch[0].length, {
                 class: 'heading-hash-text',
                 nodeName: 'span'
               }));
             }
          }
        }

        return DecorationSet.create(doc, decorations);
      },

      handleDOMEvents: {
        mouseover(view, event) {
          const target = event.target as HTMLElement;
          const headingEl = target.closest('h1, h2, h3, h4, h5, h6');
          if (headingEl) {
            const pos = view.posAtDOM(headingEl, 0);
            const resolved = view.state.doc.resolve(pos);
            const headingPos = resolved.before(resolved.depth); // Get block start
            
            // Only update if changed
            const currentState = pluginKey.getState(view.state);
            if (currentState?.hoveredPos !== headingPos) {
               view.dispatch(view.state.tr.setMeta(pluginKey, { type: ACTIONS.SET_HOVER, pos: headingPos }));
            }
          }
          return false;
        },
        mouseout(view, event) {
           const related = event.relatedTarget as HTMLElement;
           // Keep hover state if moving to widget or menu
           if (related && (related.classList.contains('heading-hash-hover') || related.closest('.heading-level-menu'))) {
             return false;
           }
           const currentState = pluginKey.getState(view.state);
           if (currentState?.hoveredPos !== null) {
              view.dispatch(view.state.tr.setMeta(pluginKey, { type: ACTIONS.SET_HOVER, pos: null }));
           }
           return false;
        }
      }
    }
  });
});

export const headingPlugin = [
  protectFirstH1Plugin,
  headingHashPlugin
];