import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import { PluginKey } from '@milkdown/kit/prose/state';
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view';

export type SlashEmojiPreviewState = {
  emoji: string | null;
  pos: number | null;
};

export const EMPTY_SLASH_EMOJI_PREVIEW_STATE: SlashEmojiPreviewState = {
  emoji: null,
  pos: null,
};

export const slashEmojiPreviewPluginKey = new PluginKey<SlashEmojiPreviewState>('slashEmojiPreview');

export function shouldUpdateSlashEmojiPreview(
  current: SlashEmojiPreviewState | null | undefined,
  emoji: string,
  pos: number
): boolean {
  return current?.emoji !== emoji || current.pos !== pos;
}

export function createSlashEmojiPreviewDecorations(state: SlashEmojiPreviewState, doc: ProseNode): DecorationSet {
  if (!state.emoji || typeof state.pos !== 'number') {
    return DecorationSet.empty;
  }

  const docSize = doc.content.size;
  const pos = Math.max(0, Math.min(state.pos, docSize));
  const $pos = doc.resolve(pos);
  const isInEmptyTextBlock = $pos.parent.isTextblock && $pos.parent.content.size === 0;

  return DecorationSet.create(doc, [
    Decoration.widget(
      pos,
      () => {
        const preview = document.createElement('span');
        preview.className = isInEmptyTextBlock
          ? 'slash-emoji-inline-preview slash-emoji-inline-preview-empty-block'
          : 'slash-emoji-inline-preview';
        preview.textContent = state.emoji;
        preview.setAttribute('data-slash-emoji-preview', 'true');
        preview.setAttribute('data-no-editor-drag-box', 'true');
        preview.setAttribute('contenteditable', 'false');
        preview.setAttribute('aria-hidden', 'true');
        return preview;
      },
      {
        side: 1,
        ignoreSelection: true,
        key: `slash-emoji-preview-${state.emoji}-${pos}`,
      }
    ),
  ]);
}
