import type { Selection, Transaction } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { slashPluginKey } from './slashPluginKey';
import { slashMenuItems } from './slashItems';
import { filterSlashItems } from './slashQuery';
import type { SlashMenuState } from './types';

const LOOKBACK_LIMIT = 50;
const SLASH_MENU_OFFSET_Y = 4;

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

function hasValidSlashPrefix(textBeforeSlash: string) {
  return textBeforeSlash.length === 0 || /\s$/.test(textBeforeSlash);
}

export function createSlashState(): SlashMenuState {
  return {
    isOpen: false,
    query: '',
    selectedIndex: 0,
  };
}

function getSlashTextRangeFromSelection(selection: Selection) {
  const $pos = selection.$from;
  const textBefore = getTextBeforeSelection(selection);
  if (textBefore == null) {
    return null;
  }

  const slashIndex = textBefore.lastIndexOf('/');

  if (slashIndex === -1) {
    return null;
  }

  if (!hasValidSlashPrefix(textBefore.slice(0, slashIndex))) {
    return null;
  }

  const query = textBefore.slice(slashIndex + 1);
  if (/\s/.test(query)) {
    return null;
  }

  return {
    query,
    deleteFrom: $pos.pos - (textBefore.length - slashIndex),
    deleteTo: $pos.pos,
  };
}

export function getSlashTextRange(view: EditorView) {
  return getSlashTextRangeFromSelection(view.state.selection);
}

export function canOpenSlashMenuFromSelection(selection: Selection) {
  if (selection.empty === false) {
    return false;
  }

  const textBefore = getTextBeforeSelection(selection);
  if (textBefore == null) {
    return false;
  }

  return hasValidSlashPrefix(textBefore);
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
