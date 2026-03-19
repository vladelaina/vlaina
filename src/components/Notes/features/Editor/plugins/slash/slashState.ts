import type { Selection, Transaction } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { slashPluginKey } from './slashPluginKey';
import { slashMenuItems } from './slashItems';
import { filterSlashItems } from './slashQuery';
import type { SlashMenuState } from './types';

const LOOKBACK_LIMIT = 50;
const SLASH_MENU_OFFSET_Y = 4;

export function createSlashState(): SlashMenuState {
  return {
    isOpen: false,
    query: '',
    selectedIndex: 0,
  };
}

function getSlashTextRangeFromSelection(selection: Selection) {
  const $pos = selection.$from;
  const textBefore = $pos.parent.textBetween(
    Math.max(0, $pos.parentOffset - LOOKBACK_LIMIT),
    $pos.parentOffset,
    null,
    '\ufffc'
  );
  const slashIndex = textBefore.lastIndexOf('/');

  if (slashIndex === -1) {
    return null;
  }

  return {
    query: textBefore.slice(slashIndex + 1),
    deleteFrom: $pos.pos - (textBefore.length - slashIndex),
    deleteTo: $pos.pos,
  };
}

export function getSlashTextRange(view: EditorView) {
  return getSlashTextRangeFromSelection(view.state.selection);
}

export function deriveSlashState(tr: Transaction, state: SlashMenuState) {
  const meta = tr.getMeta(slashPluginKey);
  if (meta) {
    return { ...state, ...meta };
  }

  if (!state.isOpen || (!tr.docChanged && !tr.selectionSet)) {
    return state;
  }

  const slashRange = getSlashTextRangeFromSelection(tr.selection);
  if (!slashRange) {
    return createSlashState();
  }

  const filtered = filterSlashItems(slashRange.query, slashMenuItems);
  if (filtered.length === 0) {
    return createSlashState();
  }

  return {
    ...state,
    query: slashRange.query,
    selectedIndex: Math.min(state.selectedIndex, filtered.length - 1),
  };
}

export function getSlashMenuPosition(view: EditorView) {
  const coords = view.coordsAtPos(view.state.selection.from);

  return {
    x: coords.left,
    y: coords.bottom + SLASH_MENU_OFFSET_Y,
  };
}
