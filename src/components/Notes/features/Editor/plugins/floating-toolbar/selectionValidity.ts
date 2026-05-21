import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import { TextSelection, type Selection } from '@milkdown/kit/prose/state';

export function hasUsableTextRange(doc: ProseNode, from: number, to: number): boolean {
  const docSize = doc.content.size;
  const safeFrom = Math.max(0, Math.min(from, docSize));
  const safeTo = Math.max(safeFrom, Math.min(to, docSize));
  if (safeFrom === safeTo) {
    return false;
  }

  return doc.textBetween(safeFrom, safeTo, '\n', '\n').trim().length > 0;
}

export function hasUsableTextSelection(selection: Selection, doc: ProseNode): selection is TextSelection {
  return (
    selection instanceof TextSelection &&
    !selection.empty &&
    hasUsableTextRange(doc, selection.from, selection.to)
  );
}
