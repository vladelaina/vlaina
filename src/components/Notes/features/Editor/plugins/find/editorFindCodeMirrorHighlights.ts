import { RangeSetBuilder, StateEffect, StateField } from '@codemirror/state';
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

const activeFindHighlight = Decoration.mark({
  class: 'vlaina-editor-find-match vlaina-editor-find-match-active',
});

const setCodeMirrorFindHighlightRanges = StateEffect.define<
  readonly CodeMirrorFindHighlightRange[]
>();

function buildCodeMirrorFindHighlightDecorations(
  ranges: readonly CodeMirrorFindHighlightRange[],
) {
  const builder = new RangeSetBuilder<Decoration>();

  for (const range of ranges) {
    if (range.from >= range.to) {
      continue;
    }

    builder.add(
      range.from,
      range.to,
      range.active ? activeFindHighlight : inactiveFindHighlight,
    );
  }

  return builder.finish();
}

const codeMirrorFindHighlightField = StateField.define({
  create() {
    return buildCodeMirrorFindHighlightDecorations([]);
  },
  update(value, tr) {
    let nextValue = value.map(tr.changes);

    for (const effect of tr.effects) {
      if (effect.is(setCodeMirrorFindHighlightRanges)) {
        nextValue = buildCodeMirrorFindHighlightDecorations(effect.value);
      }
    }

    return nextValue;
  },
  provide: (field) => CodeMirror.decorations.from(field),
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
