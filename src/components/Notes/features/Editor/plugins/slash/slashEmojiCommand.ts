import { Plugin, type EditorState } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { $prose } from '@milkdown/kit/utils';
import {
  createSlashEmojiPreviewDecorations,
  EMPTY_SLASH_EMOJI_PREVIEW_STATE,
  slashEmojiPreviewPluginKey,
  shouldUpdateSlashEmojiPreview,
} from './slashEmojiPreview';

export { shouldUpdateSlashEmojiPreview };

interface ActiveSlashEmojiPicker {
  destroy: () => void;
  handleEditorUpdate: (view: EditorView, previousState: EditorState | undefined) => void;
}

let activeSlashEmojiPicker: ActiveSlashEmojiPicker | null = null;
let pickerLoadGeneration = 0;

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

export async function openSlashEmojiPicker(view: EditorView) {
  const loadGeneration = ++pickerLoadGeneration;
  activeSlashEmojiPicker?.destroy();
  activeSlashEmojiPicker = null;
  const { SlashEmojiPickerSession } = await import('./slashEmojiPickerSession');
  if (loadGeneration !== pickerLoadGeneration) return;
  const session = new SlashEmojiPickerSession(view, (destroyedSession) => {
    if (activeSlashEmojiPicker === destroyedSession) {
      activeSlashEmojiPicker = null;
    }
  });
  activeSlashEmojiPicker = session;
  session.open();
}
