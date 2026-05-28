import { EditorSelection, RangeSetBuilder, StateEffect, StateField, type Transaction } from '@codemirror/state';
import { Decoration, EditorView as CodeMirror } from '@codemirror/view';
import type { EditorFindMatch } from './editorFindMatches';

export interface CodeMirrorFindHighlightRange {
  from: number;
  to: number;
  active: boolean;
}

interface BuildCodeMirrorFindHighlightRangesOptions {
  matches: readonly EditorFindMatch[];
  activeIndex: number;
  contentFrom: number;
  contentTo: number;
  rawText: string;
  mapDocumentOffsetToEditorOffset: (rawText: string, rawOffset: number) => number;
}

const inactiveFindHighlight = Decoration.mark({
  class: 'vlaina-editor-find-match',
});

const selectedInactiveFindHighlight = Decoration.mark({
  class: 'vlaina-editor-find-match vlaina-editor-find-match-selected',
});

const activeFindHighlight = Decoration.mark({
  class: 'vlaina-editor-find-match vlaina-editor-find-match-active',
});

const selectedActiveFindHighlight = Decoration.mark({
  class: 'vlaina-editor-find-match vlaina-editor-find-match-active vlaina-editor-find-match-selected',
});

const setCodeMirrorFindHighlightRanges = StateEffect.define<
  readonly CodeMirrorFindHighlightRange[]
>();

interface CodeMirrorFindHighlightState {
  ranges: readonly CodeMirrorFindHighlightRange[];
  decorations: ReturnType<typeof buildCodeMirrorFindHighlightDecorations>;
}

function isRangeSelected(
  range: CodeMirrorFindHighlightRange,
  selection: EditorSelection,
) {
  return selection.ranges.some(
    (selectionRange) =>
      !selectionRange.empty &&
      Math.max(range.from, selectionRange.from) < Math.min(range.to, selectionRange.to),
  );
}

function getFindHighlightDecoration(active: boolean, selected: boolean) {
  if (selected) {
    return active ? selectedActiveFindHighlight : selectedInactiveFindHighlight;
  }

  return active ? activeFindHighlight : inactiveFindHighlight;
}

function buildCodeMirrorFindHighlightDecorations(
  ranges: readonly CodeMirrorFindHighlightRange[],
  selection: EditorSelection = EditorSelection.single(0),
) {
  const builder = new RangeSetBuilder<Decoration>();

  for (const range of ranges) {
    if (range.from >= range.to) {
      continue;
    }

    if (!isRangeSelected(range, selection)) {
      builder.add(range.from, range.to, getFindHighlightDecoration(range.active, false));
      continue;
    }

    let cursor = range.from;
    for (const selectionRange of selection.ranges) {
      if (selectionRange.empty || selectionRange.to <= cursor || selectionRange.from >= range.to) {
        continue;
      }

      const selectedFrom = Math.max(cursor, selectionRange.from, range.from);
      const selectedTo = Math.min(selectionRange.to, range.to);

      if (cursor < selectedFrom) {
        builder.add(cursor, selectedFrom, getFindHighlightDecoration(range.active, false));
      }
      if (selectedFrom < selectedTo) {
        builder.add(selectedFrom, selectedTo, getFindHighlightDecoration(range.active, true));
        cursor = selectedTo;
      }
    }

    if (cursor < range.to) {
      builder.add(cursor, range.to, getFindHighlightDecoration(range.active, false));
    }
  }

  return builder.finish();
}

function mapCodeMirrorFindHighlightRanges(
  ranges: readonly CodeMirrorFindHighlightRange[],
  tr: Transaction,
) {
  if (!tr.docChanged) {
    return ranges;
  }

  return ranges
    .map((range) => ({
      ...range,
      from: tr.changes.mapPos(range.from, 1),
      to: tr.changes.mapPos(range.to, -1),
    }))
    .filter((range) => range.from < range.to);
}

const codeMirrorFindHighlightField = StateField.define<CodeMirrorFindHighlightState>({
  create() {
    const ranges: readonly CodeMirrorFindHighlightRange[] = [];
    return {
      ranges,
      decorations: buildCodeMirrorFindHighlightDecorations(ranges),
    };
  },
  update(value, tr) {
    let nextRanges = mapCodeMirrorFindHighlightRanges(value.ranges, tr);
    let shouldRebuildDecorations = tr.docChanged || Boolean(tr.selection);

    for (const effect of tr.effects) {
      if (effect.is(setCodeMirrorFindHighlightRanges)) {
        nextRanges = effect.value;
        shouldRebuildDecorations = true;
      }
    }

    if (!shouldRebuildDecorations) {
      return value;
    }

    return {
      ranges: nextRanges,
      decorations: buildCodeMirrorFindHighlightDecorations(nextRanges, tr.state.selection),
    };
  },
  provide: (field) => CodeMirror.decorations.from(field, (value) => value.decorations),
});

export const codeMirrorFindHighlightExtensions = [codeMirrorFindHighlightField];

export function buildCodeMirrorFindHighlightRanges({
  matches,
  activeIndex,
  contentFrom,
  contentTo,
  rawText,
  mapDocumentOffsetToEditorOffset,
}: BuildCodeMirrorFindHighlightRangesOptions): CodeMirrorFindHighlightRange[] {
  if (matches.length === 0 || rawText.length === 0) {
    return [];
  }

  const ranges: CodeMirrorFindHighlightRange[] = [];

  matches.forEach((match, index) => {
    match.ranges.forEach((range) => {
      const intersectFrom = Math.max(range.from, contentFrom);
      const intersectTo = Math.min(range.to, contentTo);

      if (intersectFrom >= intersectTo) {
        return;
      }

      const from = mapDocumentOffsetToEditorOffset(rawText, intersectFrom - contentFrom);
      const to = mapDocumentOffsetToEditorOffset(rawText, intersectTo - contentFrom);

      if (from >= to) {
        return;
      }

      ranges.push({
        from,
        to,
        active: index == activeIndex,
      });
    });
  });

  ranges.sort((left, right) => left.from - right.from || left.to - right.to);
  return ranges;
}

export function syncCodeMirrorFindHighlights(
  cm: CodeMirror,
  ranges: readonly CodeMirrorFindHighlightRange[],
) {
  cm.dispatch({
    effects: setCodeMirrorFindHighlightRanges.of(ranges),
  });
}
