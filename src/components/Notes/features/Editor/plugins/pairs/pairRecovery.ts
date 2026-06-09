import { closePairSpecs, openPairSpecs } from './pairSpecs';
import type { AutoInsertedCloser, EditorStateLike, SelectionLike } from './pairTypes';

const MAX_AUTO_PAIR_RECOVERY_SCAN_CHARS = 4096;

type TextblockLike = SelectionLike['$from']['parent'];

function getTextBetween(
  parent: TextblockLike,
  from: number,
  to: number,
): string {
  if (to <= from) return '';
  return parent.textBetween(from, to, '\0', '\0');
}

function dedupeRecoveredClosers(entries: AutoInsertedCloser[]): AutoInsertedCloser[] {
  const deduped = new Map<string, AutoInsertedCloser>();
  entries.forEach((entry) => {
    deduped.set(`${entry.pos}:${entry.close}`, entry);
  });
  return Array.from(deduped.values()).sort((a, b) => a.pos - b.pos);
}

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

  const parentSize = $from.parent.content.size;
  const entries: AutoInsertedCloser[] = [];
  const textStart = from - $from.parentOffset;

  if ($from.parentOffset < parentSize) {
    const close = getTextBetween($from.parent, $from.parentOffset, $from.parentOffset + 1);
    if (closePairSpecs.has(close)) {
      const scanStart = Math.max(0, $from.parentOffset - MAX_AUTO_PAIR_RECOVERY_SCAN_CHARS);
      const scanText = getTextBetween($from.parent, scanStart, $from.parentOffset + 1);
      const closeOffset = $from.parentOffset - scanStart;
      const openOffset = findMatchingOpenOffset(scanText, closeOffset, 0);
      if (openOffset >= 0) {
        entries.push({ close, pos: from });
      } else if ($from.parentOffset > 0) {
        const open = getTextBetween($from.parent, $from.parentOffset - 1, $from.parentOffset);
        const spec = openPairSpecs.get(open);
        if (spec?.close === close) {
          entries.push({ close, pos: from });
        }
      }
    }
  }

  if ($from.parentOffset > 0) {
    const previousChar = getTextBetween($from.parent, $from.parentOffset - 1, $from.parentOffset);
    if (closePairSpecs.has(previousChar)) {
      entries.push({ close: previousChar, pos: from - 1 });
    }

    const scanStart = Math.max(0, $from.parentOffset - MAX_AUTO_PAIR_RECOVERY_SCAN_CHARS);
    const scanText = getTextBetween($from.parent, scanStart, $from.parentOffset);
    entries.push(
      ...recoverTrailingNestedClosers(scanText, textStart + scanStart, 0, scanText.length),
    );
  }

  return dedupeRecoveredClosers(entries);
}

export function findRecoverableAutoCloserFromSelection(
  selection: SelectionLike,
): AutoInsertedCloser | null {
  if (!selection.empty) return null;

  const { $from, from } = selection;
  if (!$from.parent.isTextblock) return null;

  const parentSize = $from.parent.content.size;
  const forwardEnd = Math.min(parentSize, $from.parentOffset + MAX_AUTO_PAIR_RECOVERY_SCAN_CHARS);
  const forwardText = getTextBetween($from.parent, $from.parentOffset, forwardEnd);
  for (let offset = 0; offset < forwardText.length; offset += 1) {
    const close = forwardText[offset];
    if (!closePairSpecs.has(close)) continue;

    const scanStart = Math.max(0, $from.parentOffset - MAX_AUTO_PAIR_RECOVERY_SCAN_CHARS);
    const absoluteCloseOffset = $from.parentOffset + offset;
    const scanText = getTextBetween($from.parent, scanStart, absoluteCloseOffset + 1);
    const openOffset = findMatchingOpenOffset(scanText, absoluteCloseOffset - scanStart, 0);
    if (openOffset >= 0 && openOffset + scanStart < $from.parentOffset) {
      return { close, pos: from + offset };
    }
  }

  if ($from.parentOffset > 0) {
    const previousOffset = $from.parentOffset - 1;
    const close = getTextBetween($from.parent, previousOffset, $from.parentOffset);
    if (closePairSpecs.has(close)) {
      const scanStart = Math.max(0, previousOffset - MAX_AUTO_PAIR_RECOVERY_SCAN_CHARS);
      const scanText = getTextBetween($from.parent, scanStart, $from.parentOffset);
      const openOffset = findMatchingOpenOffset(scanText, previousOffset - scanStart, 0);
      if (openOffset >= 0 && openOffset + scanStart < previousOffset) {
        return { close, pos: from - 1 };
      }
    }
  }

  return null;
}
