import { Plugin } from '@milkdown/kit/prose/state';
import { $prose } from '@milkdown/kit/utils';
import { SlashMenuView } from './SlashMenuView';
import { getSlashMenuItems } from './slashItems';
import { slashPluginKey } from './slashPluginKey';
import { filterSlashItems } from './slashQuery';
import {
  canOpenSlashMenuFromSelection,
  createSlashState,
  deriveSlashState,
} from './slashState';
import { isPlainSlashMenuNavigationKey } from './slashKeyboard';

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
            return false;
          }

          return false;
        }

        if (event.isComposing) {
          return false;
        }

        const filtered = filterSlashItems(state.query, getSlashMenuItems());
        if (filtered.length === 0) {
          return false;
        }

        if (isPlainSlashMenuNavigationKey(event)) {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            view.dispatch(
              view.state.tr.setMeta(slashPluginKey, {
                selectedIndex: (state.selectedIndex + 1) % filtered.length,
              })
            );
            return true;
          }

          if (event.key === 'ArrowUp') {
            event.preventDefault();
            view.dispatch(
              view.state.tr.setMeta(slashPluginKey, {
                selectedIndex: (state.selectedIndex - 1 + filtered.length) % filtered.length,
              })
            );
            return true;
          }
        }

        switch (event.key) {
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
