import { Plugin } from '@milkdown/kit/prose/state';
import { $prose } from '@milkdown/kit/utils';
import { SlashMenuView } from './SlashMenuView';
import { slashMenuItems } from './slashItems';
import { slashPluginKey } from './slashPluginKey';
import { filterSlashItems } from './slashQuery';
import {
  canOpenSlashMenuFromSelection,
  createSlashState,
  deriveSlashState,
  getSlashTextRange,
} from './slashState';

export const slashPlugin = $prose((ctx) => {
  return new Plugin({
    key: slashPluginKey,
    state: {
      init: () => createSlashState(),
      apply: deriveSlashState,
    },
    props: {
      handleKeyDown(view, event) {
        const state = slashPluginKey.getState(view.state);

        if (!state?.isOpen) {
          if (
            event.key === '/' &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.altKey &&
            !event.isComposing &&
            canOpenSlashMenuFromSelection(view.state.selection)
          ) {
            setTimeout(() => {
              if (!view.dom.isConnected) {
                return;
              }

              const slashRange = getSlashTextRange(view);
              if (!slashRange || slashRange.query !== '') {
                return;
              }

              view.dispatch(
                view.state.tr.setMeta(slashPluginKey, {
                  isOpen: true,
                  query: '',
                  selectedIndex: 0,
                })
              );
            }, 0);
          }

          return false;
        }

        if (event.isComposing) {
          return false;
        }

        const filtered = filterSlashItems(state.query, slashMenuItems);
        if (filtered.length === 0) {
          return false;
        }

        switch (event.key) {
          case 'ArrowDown':
            event.preventDefault();
            view.dispatch(
              view.state.tr.setMeta(slashPluginKey, {
                selectedIndex: (state.selectedIndex + 1) % filtered.length,
              })
            );
            return true;

          case 'ArrowUp':
            event.preventDefault();
            view.dispatch(
              view.state.tr.setMeta(slashPluginKey, {
                selectedIndex: (state.selectedIndex - 1 + filtered.length) % filtered.length,
              })
            );
            return true;

          case 'Enter':
          case 'Tab':
            event.preventDefault();
            (view as typeof view & { slashMenuView?: SlashMenuView }).slashMenuView?.applySelectedItem(
              state.selectedIndex
            );
            return true;

          case 'Escape':
            event.preventDefault();
            view.dispatch(view.state.tr.setMeta(slashPluginKey, createSlashState()));
            return true;

          default:
            return false;
        }
      },
    },
    view(editorView) {
      const slashMenuView = new SlashMenuView(editorView, ctx);
      (editorView as typeof editorView & { slashMenuView?: SlashMenuView }).slashMenuView = slashMenuView;

      return {
        update: () => {
          slashMenuView.update();
        },
        destroy() {
          delete (editorView as typeof editorView & { slashMenuView?: SlashMenuView }).slashMenuView;
          slashMenuView.destroy();
        },
      };
    },
  });
});
