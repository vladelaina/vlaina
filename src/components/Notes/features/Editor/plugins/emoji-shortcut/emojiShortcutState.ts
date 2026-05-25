import type { Selection, Transaction } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { emojiShortcutPluginKey } from './emojiShortcutPluginKey';
import { filterEmojiShortcutItems } from './emojiShortcutQuery';
import type { EmojiShortcutState } from './types';

const LOOKBACK_LIMIT = 50;
const EMOJI_SHORTCUT_OFFSET_Y = 4;

function getTextBeforeSelection(selection: Selection) {
  const $pos = selection.$from;
  const parent = $pos.parent as typeof $pos.parent & {
    isTextblock?: boolean;
    type?: { spec?: { code?: boolean } };
  };

  if (parent.isTextblock === false || parent.type?.spec?.code) {
    return null;
  }

  return parent.textBetween(
    Math.max(0, $pos.parentOffset - LOOKBACK_LIMIT),
    $pos.parentOffset,
    null,
    '\ufffc'
  );
}

function hasValidEmojiShortcutPrefix(textBeforeColon: string) {
  return textBeforeColon.length === 0 || /\s$/.test(textBeforeColon);
}

export function createEmojiShortcutState(): EmojiShortcutState {
  return {
    isOpen: false,
    query: '',
  };
}

function getEmojiShortcutTextRangeFromSelection(selection: Selection) {
  const $pos = selection.$from;
  const textBefore = getTextBeforeSelection(selection);
  if (textBefore == null) {
    return null;
  }

  const asciiColonIndex = textBefore.lastIndexOf(':');
  const fullwidthColonIndex = textBefore.lastIndexOf('：');
  const colonIndex = Math.max(asciiColonIndex, fullwidthColonIndex);
  if (colonIndex === -1) {
    return null;
  }

  if (!hasValidEmojiShortcutPrefix(textBefore.slice(0, colonIndex))) {
    return null;
  }

  const query = textBefore.slice(colonIndex + 1);
  if (query.length === 0 || /\s/.test(query) || /[:：]/.test(query)) {
    return null;
  }

  return {
    query,
    deleteFrom: $pos.pos - (textBefore.length - colonIndex),
    deleteTo: $pos.pos,
  };
}

export function getEmojiShortcutTextRange(view: EditorView) {
  return getEmojiShortcutTextRangeFromSelection(view.state.selection);
}

export function deriveEmojiShortcutState(tr: Transaction, state: EmojiShortcutState) {
  const meta = tr.getMeta(emojiShortcutPluginKey);
  if (meta) {
    return { ...state, ...meta };
  }

  if (!tr.docChanged && !tr.selectionSet) {
    return state;
  }

  if (!state.isOpen && !tr.docChanged) {
    return state;
  }

  const emojiRange = getEmojiShortcutTextRangeFromSelection(tr.selection);
  if (!emojiRange) {
    return state.isOpen ? createEmojiShortcutState() : state;
  }

  const filtered = filterEmojiShortcutItems(emojiRange.query);
  if (filtered.length === 0) {
    return state.isOpen ? createEmojiShortcutState() : state;
  }

  return {
    ...state,
    isOpen: true,
    query: emojiRange.query,
  };
}

export function getEmojiShortcutMenuPosition(view: EditorView) {
  const coords = view.coordsAtPos(view.state.selection.from);

  return {
    x: coords.left,
    y: coords.bottom + EMOJI_SHORTCUT_OFFSET_Y,
  };
}
