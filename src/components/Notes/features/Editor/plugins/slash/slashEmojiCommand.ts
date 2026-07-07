import { Plugin } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { $prose } from '@milkdown/kit/utils';
import { SlashEmojiPickerSession } from './slashEmojiPickerSession';
import {
  createSlashEmojiPreviewDecorations,
  EMPTY_SLASH_EMOJI_PREVIEW_STATE,
  slashEmojiPreviewPluginKey,
  shouldUpdateSlashEmojiPreview,
} from './slashEmojiPreview';

export { shouldUpdateSlashEmojiPreview };

let activeSlashEmojiPicker: SlashEmojiPickerSession | null = null;

export const slashEmojiPreviewPlugin = $prose(() => new Plugin({
  key: slashEmojiPreviewPluginKey,
  state: {
    init: () => EMPTY_SLASH_EMOJI_PREVIEW_STATE,
    apply(tr, previous) {
      const meta = tr.getMeta(slashEmojiPreviewPluginKey);
      if (meta) {
        return meta;
      }
      if (tr.docChanged) {
        return EMPTY_SLASH_EMOJI_PREVIEW_STATE;
      }
      return previous;
    },
  },
  props: {
    decorations(editorState) {
      const state = slashEmojiPreviewPluginKey.getState(editorState) ?? EMPTY_SLASH_EMOJI_PREVIEW_STATE;
      return createSlashEmojiPreviewDecorations(state, editorState.doc);
    },
  },
  view() {
    return {
      update(view, previousState) {
        activeSlashEmojiPicker?.handleEditorUpdate(view, previousState);
      },
    };
  },
}));

export function openSlashEmojiPicker(view: EditorView) {
  activeSlashEmojiPicker?.destroy();
  activeSlashEmojiPicker = new SlashEmojiPickerSession(view, (session) => {
    if (activeSlashEmojiPicker === session) {
      activeSlashEmojiPicker = null;
    }
  });
  activeSlashEmojiPicker.open();
}
