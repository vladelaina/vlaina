import { $prose } from '@milkdown/kit/utils';
import { Plugin } from '@milkdown/kit/prose/state';
import { EmojiShortcutMenuView } from './EmojiShortcutMenuView';
import { emojiShortcutPluginKey } from './emojiShortcutPluginKey';
import { createEmojiShortcutState, deriveEmojiShortcutState } from './emojiShortcutState';

export const emojiShortcutPlugin = $prose(() => {
  return new Plugin({
    key: emojiShortcutPluginKey,
    state: {
      init: () => createEmojiShortcutState(),
      apply: deriveEmojiShortcutState,
    },
    view: (editorView) => {
      const emojiShortcutMenuView = new EmojiShortcutMenuView(editorView);

      return {
        update: () => {
          emojiShortcutMenuView.update();
        },
        destroy: () => {
          emojiShortcutMenuView.destroy();
        },
      };
    },
  });
});

