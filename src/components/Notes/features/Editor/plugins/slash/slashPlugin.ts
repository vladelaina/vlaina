// Slash menu plugin
import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view';
import { slashMenuItems, filterSlashItems } from './slashItems';
import type { SlashMenuState } from './types';

export const slashPluginKey = new PluginKey<SlashMenuState>('slashMenu');

// Create slash menu state
function createSlashState(): SlashMenuState {
  return {
    isOpen: false,
    query: '',
    position: { x: 0, y: 0 },
    selectedIndex: 0
  };
}

export const slashPlugin = $prose((ctx) => {
  return new Plugin({
    key: slashPluginKey,
    state: {
      init: () => createSlashState(),
      apply(tr, state) {
        const meta = tr.getMeta(slashPluginKey);
        if (meta) {
          return { ...state, ...meta };
        }
        
        // Check if we should close the menu
        if (state.isOpen && tr.docChanged) {
          const { selection } = tr;
          const $pos = selection.$from;
          const textBefore = $pos.parent.textBetween(
            Math.max(0, $pos.parentOffset - 50),
            $pos.parentOffset,
            null,
            '\ufffc'
          );
          
          const slashIndex = textBefore.lastIndexOf('/');
          if (slashIndex === -1) {
            return createSlashState();
          }
          
          const query = textBefore.slice(slashIndex + 1);
          const filtered = filterSlashItems(query, slashMenuItems);
          
          if (filtered.length === 0) {
            return createSlashState();
          }
          
          return {
            ...state,
            query,
            selectedIndex: Math.min(state.selectedIndex, filtered.length - 1)
          };
        }
        
        return state;
      }
    },
    props: {
      handleKeyDown(view, event) {
        const state = slashPluginKey.getState(view.state);
        if (!state?.isOpen) {
          // Check for slash trigger
          if (event.key === '/') {
            const { selection } = view.state;
            const coords = view.coordsAtPos(selection.from);
            
            setTimeout(() => {
              view.dispatch(
                view.state.tr.setMeta(slashPluginKey, {
                  isOpen: true,
                  query: '',
                  position: { x: coords.left, y: coords.bottom + 4 },
                  selectedIndex: 0
                })
              );
            }, 0);
          }
          return false;
        }
        
        const filtered = filterSlashItems(state.query, slashMenuItems);
        
        switch (event.key) {
          case 'ArrowDown':
            event.preventDefault();
            view.dispatch(
              view.state.tr.setMeta(slashPluginKey, {
                selectedIndex: (state.selectedIndex + 1) % filtered.length
              })
            );
            return true;
            
          case 'ArrowUp':
            event.preventDefault();
            view.dispatch(
              view.state.tr.setMeta(slashPluginKey, {
                selectedIndex: (state.selectedIndex - 1 + filtered.length) % filtered.length
              })
            );
            return true;
            
          case 'Enter':
          case 'Tab':
            event.preventDefault();
            if (filtered.length > 0) {
              const item = filtered[state.selectedIndex];
              
              // Delete the slash and query
              const { selection } = view.state;
              const $pos = selection.$from;
              const textBefore = $pos.parent.textBetween(
                Math.max(0, $pos.parentOffset - 50),
                $pos.parentOffset,
                null,
                '\ufffc'
              );
              const slashIndex = textBefore.lastIndexOf('/');
              const deleteFrom = $pos.pos - (textBefore.length - slashIndex);
              
              view.dispatch(
                view.state.tr
                  .delete(deleteFrom, $pos.pos)
                  .setMeta(slashPluginKey, createSlashState())
              );
              
              // Execute the action
              item.action(ctx);
            }
            return true;
            
          case 'Escape':
            event.preventDefault();
            view.dispatch(
              view.state.tr.setMeta(slashPluginKey, createSlashState())
            );
            return true;
        }
        
        return false;
      },
      decorations(state) {
        const slashState = slashPluginKey.getState(state);
        if (!slashState?.isOpen) return DecorationSet.empty;
        
        // Create a widget decoration for the menu
        const widget = Decoration.widget(
          state.selection.from,
          () => {
            const container = document.createElement('div');
            container.className = 'slash-menu-container';
            container.setAttribute('data-slash-menu', 'true');
            return container;
          },
          { side: 1 }
        );
        
        return DecorationSet.create(state.doc, [widget]);
      }
    },
    view(editorView) {
      let menuElement: HTMLElement | null = null;
      
      const updateMenu = () => {
        const state = slashPluginKey.getState(editorView.state);
        
        if (!state?.isOpen) {
          if (menuElement) {
            menuElement.remove();
            menuElement = null;
          }
          return;
        }
        
        const filtered = filterSlashItems(state.query, slashMenuItems);
        
        if (filtered.length === 0) {
          if (menuElement) {
            menuElement.remove();
            menuElement = null;
          }
          return;
        }
        
        if (!menuElement) {
          menuElement = document.createElement('div');
          menuElement.className = 'slash-menu';
          document.body.appendChild(menuElement);
        }
        
        menuElement.style.left = `${state.position.x}px`;
        menuElement.style.top = `${state.position.y}px`;
        
        // Group items
        const groups = new Map<string, typeof filtered>();
        filtered.forEach(item => {
          const group = groups.get(item.group) || [];
          group.push(item);
          groups.set(item.group, group);
        });
        
        let html = '';
        let globalIndex = 0;
        
        groups.forEach((items, groupName) => {
          html += `<div class="slash-menu-group">
            <div class="slash-menu-group-title">${groupName}</div>`;
          
          items.forEach(item => {
            const isSelected = globalIndex === state.selectedIndex;
            html += `<div class="slash-menu-item ${isSelected ? 'selected' : ''}" data-index="${globalIndex}">
              <span class="slash-menu-item-icon">${item.icon}</span>
              <div class="slash-menu-item-content">
                <span class="slash-menu-item-name">${item.name}</span>
                ${item.description ? `<span class="slash-menu-item-desc">${item.description}</span>` : ''}
              </div>
            </div>`;
            globalIndex++;
          });
          
          html += '</div>';
        });
        
        menuElement.innerHTML = html;
        
        // Add click handlers
        menuElement.querySelectorAll('.slash-menu-item').forEach((el, index) => {
          el.addEventListener('click', () => {
            const item = filtered[index];
            
            // Delete the slash and query
            const { selection } = editorView.state;
            const $pos = selection.$from;
            const textBefore = $pos.parent.textBetween(
              Math.max(0, $pos.parentOffset - 50),
              $pos.parentOffset,
              null,
              '\ufffc'
            );
            const slashIndex = textBefore.lastIndexOf('/');
            const deleteFrom = $pos.pos - (textBefore.length - slashIndex);
            
            editorView.dispatch(
              editorView.state.tr
                .delete(deleteFrom, $pos.pos)
                .setMeta(slashPluginKey, createSlashState())
            );
            
            item.action(ctx);
            editorView.focus();
          });
        });
        
        // Scroll selected item into view
        const selectedEl = menuElement.querySelector('.slash-menu-item.selected');
        selectedEl?.scrollIntoView({ block: 'nearest' });
      };
      
      return {
        update: updateMenu,
        destroy() {
          if (menuElement) {
            menuElement.remove();
          }
        }
      };
    }
  });
});
