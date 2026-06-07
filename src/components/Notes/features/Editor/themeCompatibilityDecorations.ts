import { Plugin } from '@milkdown/kit/prose/state';
import { DecorationSet } from '@milkdown/kit/prose/view';
import { $prose } from '@milkdown/kit/utils';
import { buildTyporaCompatibilityDecorations } from './themeCompatibilityDecorations/typoraDecorations';

function buildCompatibilityDecorations(doc: any): DecorationSet {
  return buildTyporaCompatibilityDecorations(doc);
}

export const themeCompatibilityDecorationsPlugin = $prose(() => {
  return new Plugin({
    state: {
      init(_config, state) {
        return buildCompatibilityDecorations(state.doc);
      },
      apply(tr, previous, _oldState, newState) {
        if (!tr.docChanged) return previous.map(tr.mapping, tr.doc);
        return buildCompatibilityDecorations(newState.doc);
      },
    },
    props: {
      decorations(state) {
        return this.getState(state) ?? DecorationSet.empty;
      },
    },
  });
});
