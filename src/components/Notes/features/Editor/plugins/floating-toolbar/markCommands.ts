import { Selection, TextSelection } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { sanitizeEditorLinkHref } from '../links/utils/linkHref';
import { hasSelectedBlocks } from '../cursor/blockSelectionPluginState';
import { markEditorUserInput } from '../shared/userInputEvents';

function collapseSelectionAfterInlineApply(tr: EditorView['state']['tr'], pos: number): void {
  const clampedPos = Math.max(0, Math.min(pos, tr.doc.content.size));
  const $pos = tr.doc.resolve(clampedPos);

  if ($pos.parent.inlineContent) {
    tr.setSelection(TextSelection.create(tr.doc, clampedPos));
    return;
  }

  tr.setSelection(Selection.near($pos, -1));
}

export function toggleMark(view: EditorView, markName: string): void {
  if (hasSelectedBlocks(view.state)) {
    return;
  }

  const { state, dispatch } = view;
  const markType = state.schema.marks[markName];
  if (!markType) {
    return;
  }

  const { from, to } = state.selection;
  const hasMark = state.doc.rangeHasMark(from, to, markType);
  const tr = hasMark
    ? state.tr.removeMark(from, to, markType)
    : state.tr.addMark(from, to, markType.create());

  markEditorUserInput(view);
  dispatch(tr);
  view.focus();
}

export function toggleBold(view: EditorView): void {
  toggleMark(view, 'strong');
}

export function toggleItalic(view: EditorView): void {
  toggleMark(view, 'emphasis');
}

export function toggleUnderline(view: EditorView): void {
  toggleMark(view, 'underline');
}

export function toggleStrikethrough(view: EditorView): void {
  toggleMark(view, 'strike_through');
}

export function toggleCode(view: EditorView): void {
  toggleMark(view, 'inlineCode');
}

export function toggleHighlight(view: EditorView): void {
  toggleMark(view, 'highlight');
}

export function setLink(view: EditorView, url: string | null): void {
  if (hasSelectedBlocks(view.state)) {
    return;
  }

  const { state, dispatch } = view;
  const { from, to } = state.selection;
  const linkMark = state.schema.marks.link;

  if (!linkMark) {
    return;
  }

  const safeUrl = sanitizeEditorLinkHref(url);
  const tr = safeUrl !== null
    ? state.tr.addMark(from, to, linkMark.create({ href: safeUrl }))
    : state.tr.removeMark(from, to, linkMark);

  markEditorUserInput(view);
  dispatch(tr);
  view.focus();
}

export function setTextColor(view: EditorView, color: string | null): void {
  if (hasSelectedBlocks(view.state)) {
    return;
  }

  const { state, dispatch } = view;
  const { from, to } = state.selection;
  const colorMark = state.schema.marks.textColor;
  const bgColorMark = state.schema.marks.bgColor;

  if (!colorMark) {
    return;
  }

  const tr = state.tr;
  if (color && bgColorMark) {
    tr.removeMark(from, to, bgColorMark);
  }
  if (color) {
    tr.addMark(from, to, colorMark.create({ color }));
  } else {
    tr.removeMark(from, to, colorMark);
  }

  collapseSelectionAfterInlineApply(tr, to);
  markEditorUserInput(view);
  dispatch(tr);
  view.focus();
}

export function setBgColor(view: EditorView, color: string | null): void {
  if (hasSelectedBlocks(view.state)) {
    return;
  }

  const { state, dispatch } = view;
  const { from, to } = state.selection;
  const colorMark = state.schema.marks.bgColor;
  const textColorMark = state.schema.marks.textColor;

  if (!colorMark) {
    return;
  }

  const tr = state.tr;
  if (color && textColorMark) {
    tr.removeMark(from, to, textColorMark);
  }
  if (color) {
    tr.addMark(from, to, colorMark.create({ color }));
  } else {
    tr.removeMark(from, to, colorMark);
  }

  collapseSelectionAfterInlineApply(tr, to);
  markEditorUserInput(view);
  dispatch(tr);
  view.focus();
}
