import type { EditorView } from '@milkdown/kit/prose/view';
import type { BlankAreaPlainClickAction } from './blankAreaPlainClick';
import { INTERACTIVE_SELECTOR } from './blankAreaTextLineHit';

const MIN_END_GAP_PX = 8;
const LINE_VERTICAL_SLACK_PX = 4;

export function resolveTextblockLineEndAtPoint(
  view: EditorView,
  clientX: number,
  clientY: number,
): BlankAreaPlainClickAction | null {
  try {
    const pos = view.posAtCoords({ left: clientX, top: clientY })?.pos;
    if (pos === undefined) return null;
    const $pos = view.state.doc.resolve(pos);
    if (!$pos.parent.isTextblock) return null;
    const endCoords = view.coordsAtPos(pos);
    if (
      clientY < endCoords.top - LINE_VERTICAL_SLACK_PX
      || clientY > endCoords.bottom + LINE_VERTICAL_SLACK_PX
    ) return null;
    if (clientX < endCoords.right + MIN_END_GAP_PX) return null;

    return {
      targetPos: pos,
      bias: -1,
      blockFrom: $pos.before($pos.depth),
    };
  } catch {
    return null;
  }
}

export function resolveTextblockLineEndPlainClick(
  view: EditorView,
  event: MouseEvent,
): BlankAreaPlainClickAction | null {
  if (!(event.target instanceof Node)) return null;
  const targetElement = event.target instanceof Element ? event.target : event.target.parentElement;
  if (targetElement?.closest(INTERACTIVE_SELECTOR)) return null;

  return resolveTextblockLineEndAtPoint(view, event.clientX, event.clientY);
}
