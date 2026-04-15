import type { EditorView } from '@milkdown/kit/prose/view';

export function toggleMark(view: EditorView, markName: string): void {
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
  const { state, dispatch } = view;
  const { from, to } = state.selection;
  const linkMark = state.schema.marks.link;

  if (!linkMark) {
    return;
  }

  const tr = url !== null
    ? state.tr.addMark(from, to, linkMark.create({ href: url }))
    : state.tr.removeMark(from, to, linkMark);

  dispatch(tr);
  view.focus();
}

export function setTextColor(view: EditorView, color: string | null): void {
  const { state, dispatch } = view;
  const { from, to } = state.selection;
  const colorMark = state.schema.marks.textColor;

  if (!colorMark) {
    return;
  }

  const tr = color
    ? state.tr.addMark(from, to, colorMark.create({ color }))
    : state.tr.removeMark(from, to, colorMark);

  dispatch(tr);
  view.focus();
}

export function setBgColor(view: EditorView, color: string | null): void {
  const { state, dispatch } = view;
  const { from, to } = state.selection;
  const colorMark = state.schema.marks.bgColor;

  if (!colorMark) {
    return;
  }

  const tr = color
    ? state.tr.addMark(from, to, colorMark.create({ color }))
    : state.tr.removeMark(from, to, colorMark);

  dispatch(tr);
  view.focus();
}
