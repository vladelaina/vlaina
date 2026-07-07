import type { EditorView } from '@milkdown/kit/prose/view';
import type { SelectionColorPreviewSignature } from './previewStyleState';

export function getSelectionColorPreviewSignature(view: EditorView): SelectionColorPreviewSignature {
  const selection = view.state.selection;
  if (
    !selection ||
    typeof selection.from !== 'number' ||
    typeof selection.to !== 'number' ||
    typeof selection.empty !== 'boolean'
  ) {
    return null;
  }

  return {
    empty: selection.empty,
    from: selection.from,
    to: selection.to,
  };
}

export function hasSameSelectionColorPreviewSignature(
  current: SelectionColorPreviewSignature,
  previous: SelectionColorPreviewSignature
): boolean {
  if (!current || !previous) {
    return current === previous;
  }

  return (
    current.empty === previous.empty &&
    current.from === previous.from &&
    current.to === previous.to
  );
}
