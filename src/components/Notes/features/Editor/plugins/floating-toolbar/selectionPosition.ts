import type { EditorView } from '@milkdown/kit/prose/view';
import { themeDomStyleTokens } from '@/styles/themeTokens';

export function calculatePositionForRange(view: EditorView, from: number, to: number): {
  x: number;
  y: number;
  placement: 'top' | 'bottom';
} {
  const start = view.coordsAtPos(from);
  const end = view.coordsAtPos(to);

  const x = (start.left + end.left) / 2;
  const viewportBottom =
    typeof window !== 'undefined' ? window.innerHeight : Number.POSITIVE_INFINITY;
  const placement = viewportBottom - end.bottom < 80 ? 'top' : 'bottom';
  const finalY = placement === 'bottom'
    ? end.bottom + themeDomStyleTokens.editorPopupAnchorOffsetPx
    : start.top - themeDomStyleTokens.editorPopupAnchorOffsetPx;

  return { x, y: finalY, placement };
}

export function calculatePosition(view: EditorView): {
  x: number;
  y: number;
  placement: 'top' | 'bottom';
} {
  const { state } = view;
  const { from, to } = state.selection;

  return calculatePositionForRange(view, from, to);
}

export function calculateBottomPositionForRange(view: EditorView, from: number, to: number): {
  x: number;
  y: number;
  placement: 'bottom';
} {
  const start = view.coordsAtPos(from);
  const end = view.coordsAtPos(to);

  return {
    x: start.left,
    y: end.bottom + themeDomStyleTokens.editorPopupAnchorOffsetPx,
    placement: 'bottom',
  };
}

export function calculateBottomPosition(view: EditorView): {
  x: number;
  y: number;
  placement: 'bottom';
} {
  const { state } = view;
  const { from, to } = state.selection;

  return calculateBottomPositionForRange(view, from, to);
}
