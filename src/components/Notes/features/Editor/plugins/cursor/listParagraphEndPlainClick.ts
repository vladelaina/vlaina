import type { EditorView } from '@milkdown/kit/prose/view';
import type { BlankAreaPlainClickAction } from './blankAreaPlainClick';

const MIN_END_GAP_PX = 8;
const LIST_TEXTBLOCK_SELECTOR = 'p, h1, h2, h3, h4, h5, h6, blockquote';

export function resolveListParagraphEndPlainClick(
  view: EditorView,
  event: MouseEvent,
): BlankAreaPlainClickAction | null {
  const target = event.target instanceof Element
    ? event.target
    : event.target instanceof Node
      ? event.target.parentElement
      : null;
  const textBlock = target?.closest(LIST_TEXTBLOCK_SELECTOR);
  if (!(textBlock instanceof HTMLElement) || !view.dom.contains(textBlock)) return null;
  const listItem = textBlock.closest('li');
  if (!(listItem instanceof HTMLElement) || !view.dom.contains(listItem)) return null;
  if (textBlock.parentElement !== listItem) return null;

  try {
    const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
    if (pos === undefined) return null;
    const $pos = view.state.doc.resolve(pos);
    if (!$pos.parent.isTextblock) return null;
    if ($pos.parentOffset !== $pos.parent.content.size) return null;
    const endCoords = view.coordsAtPos(pos);
    if (event.clientX < endCoords.right + MIN_END_GAP_PX) return null;

    return {
      targetPos: pos,
      bias: -1,
      blockFrom: $pos.before($pos.depth),
    };
  } catch {
    return null;
  }
}
