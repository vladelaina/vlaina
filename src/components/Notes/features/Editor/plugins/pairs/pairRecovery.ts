import { closePairSpecs, openPairSpecs } from './pairSpecs';
import type { AutoInsertedCloser, EditorStateLike, SelectionLike } from './pairTypes';

function findMatchingOpenOffset(
  text: string,
  closeOffset: number,
  rangeStart: number,
): number {
  const close = text[closeOffset];
  const spec = closePairSpecs.get(close);
  if (!spec || spec.symmetric) return -1;

  let depth = 0;

  for (let offset = closeOffset - 1; offset >= rangeStart; offset -= 1) {
    const char = text[offset];
    if (char === close) {
      depth += 1;
      continue;
    }

    if (char !== spec.open) continue;
    if (depth === 0) return offset;
    depth -= 1;
  }

  return -1;
}

function recoverTrailingNestedClosers(
  text: string,
  textStart: number,
  rangeStart: number,
  rangeEnd: number,
): AutoInsertedCloser[] {
  if (rangeEnd <= rangeStart) return [];

  const closeOffset = rangeEnd - 1;
  const openOffset = findMatchingOpenOffset(text, closeOffset, rangeStart);
  if (openOffset < 0) return [];

  return [
    ...recoverTrailingNestedClosers(text, textStart, openOffset + 1, closeOffset),
    { close: text[closeOffset], pos: textStart + closeOffset },
  ];
}

export function recoverSelectionAutoClosers(
  newState: EditorStateLike,
): AutoInsertedCloser[] {
  if (!newState.selection.empty) return [];

  const { $from, from } = newState.selection;
  if (!$from.parent.isTextblock) return [];
  const text = $from.parent.textContent;
  const entries: AutoInsertedCloser[] = [];
  const textStart = from - $from.parentOffset;

  if ($from.parentOffset < text.length) {
    const close = text[$from.parentOffset];
    if (closePairSpecs.has(close)) {
      const openOffset = findMatchingOpenOffset(text, $from.parentOffset, 0);
      if (openOffset >= 0) {
        entries.push({ close, pos: from });
      } else if ($from.parentOffset > 0) {
        const open = text[$from.parentOffset - 1];
        const spec = openPairSpecs.get(open);
        if (spec?.close === close) {
          entries.push({ close, pos: from });
        }
      }
    }
  }

  if ($from.parentOffset > 0) {
    const previousChar = text[$from.parentOffset - 1];
    if (closePairSpecs.has(previousChar)) {
      entries.push({ close: previousChar, pos: from - 1 });
    }

    entries.push(
      ...recoverTrailingNestedClosers(text, textStart, 0, $from.parentOffset),
    );
  }

  return entries;
}

export function findRecoverableAutoCloserFromSelection(
  selection: SelectionLike,
): AutoInsertedCloser | null {
  if (!selection.empty) return null;

  const { $from, from } = selection;
  if (!$from.parent.isTextblock) return null;

  const text = $from.parent.textContent;
  for (let offset = $from.parentOffset; offset < text.length; offset += 1) {
    const close = text[offset];
    if (!closePairSpecs.has(close)) continue;

    const openOffset = findMatchingOpenOffset(text, offset, 0);
    if (openOffset >= 0 && openOffset < $from.parentOffset) {
      return { close, pos: from + (offset - $from.parentOffset) };
    }
  }

  if ($from.parentOffset > 0) {
    const previousOffset = $from.parentOffset - 1;
    const close = text[previousOffset];
    if (closePairSpecs.has(close)) {
      const openOffset = findMatchingOpenOffset(text, previousOffset, 0);
      if (openOffset >= 0 && openOffset < previousOffset) {
        return { close, pos: from - 1 };
      }
    }
  }

  return null;
}
