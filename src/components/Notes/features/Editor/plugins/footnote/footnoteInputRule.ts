import { $inputRule } from '@milkdown/kit/utils';
import { InputRule } from '@milkdown/kit/prose/inputrules';
import { normalizeFootnoteLabel } from './footnoteLabels';

type UndoableInputRule = InputRule & { undoable?: boolean };

export const MAX_FOOTNOTE_REF_INPUT_PREFIX_CHECK_CHARS = 256;

export function hasNonBlankFootnoteRefInputPrefix(
  doc: { textBetween: (from: number, to: number) => string },
  lineStart: number,
  start: number
): boolean {
  const textBefore = doc.textBetween(
    Math.max(lineStart, start - MAX_FOOTNOTE_REF_INPUT_PREFIX_CHECK_CHARS),
    start
  );
  return textBefore.trim() !== '';
}

export const footnoteRefInputRule = $inputRule(() => {
  const rule = new InputRule(
    /\[\^([^\]]+)\]$/,
    (state, match, start, end) => {
      const id = normalizeFootnoteLabel(match[1]);
      if (!id) return null;

      const $pos = state.doc.resolve(start);
      const lineStart = $pos.start();

      if (!hasNonBlankFootnoteRefInputPrefix(state.doc, lineStart, start)) return null;

      const { tr, schema } = state;
      const nodeType = schema.nodes.footnote_reference ?? schema.nodes.footnote_ref;
      if (!nodeType) return null;
      const attrs = nodeType.name === 'footnote_reference' ? { label: id } : { id };

      return tr
        .delete(start, end)
        .replaceSelectionWith(nodeType.create(attrs));
    }
  );
  (rule as UndoableInputRule).undoable = false;
  return rule;
});
