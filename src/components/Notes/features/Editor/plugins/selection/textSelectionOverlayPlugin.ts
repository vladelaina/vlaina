import { AllSelection, Plugin, PluginKey, TextSelection, type EditorState } from '@milkdown/kit/prose/state';
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view';
import { $prose } from '@milkdown/kit/utils';
import { hasSelectedBlocks } from '../cursor/blockSelectionPluginState';

export const TEXT_SELECTION_OVERLAY_CLASS = 'vlaina-text-selection-overlay';
const TEXT_SELECTION_OVERLAY_ACTIVE_CLASS = 'vlaina-text-selection-overlay-active';
const textSelectionOverlayPluginKey = new PluginKey<DecorationSet>('vlainaTextSelectionOverlay');

function isTextSelectionOverlayEligible(state: EditorState): boolean {
  const { selection } = state;
  if (selection.empty) return false;
  if (!(selection instanceof TextSelection) && !(selection instanceof AllSelection)) return false;
  if (hasSelectedBlocks(state)) return false;
  return true;
}

function createTextSelectionDecorations(state: EditorState): DecorationSet {
  const { doc, selection } = state;
  if (!isTextSelectionOverlayEligible(state)) return DecorationSet.empty;

  const decorations: Decoration[] = [];
  doc.nodesBetween(selection.from, selection.to, (node, pos) => {
    if (!node.isText) return;

    const from = Math.max(selection.from, pos);
    const to = Math.min(selection.to, pos + node.nodeSize);
    if (to <= from) return;

    decorations.push(Decoration.inline(from, to, {
      class: TEXT_SELECTION_OVERLAY_CLASS,
    }));
  });

  return decorations.length > 0 ? DecorationSet.create(doc, decorations) : DecorationSet.empty;
}

export const textSelectionOverlayPlugin = $prose(() => {
  return new Plugin({
    key: textSelectionOverlayPluginKey,
    state: {
      init(_, state) {
        return createTextSelectionDecorations(state);
      },
      apply(tr, previous, _oldState, newState) {
        if (!tr.docChanged && !tr.selectionSet) return previous;
        return createTextSelectionDecorations(newState);
      },
    },
    props: {
      decorations(state) {
        return textSelectionOverlayPluginKey.getState(state) ?? DecorationSet.empty;
      },
    },
    view(view) {
      const syncActiveClass = () => {
        const active = isTextSelectionOverlayEligible(view.state);
        view.dom.classList.toggle(TEXT_SELECTION_OVERLAY_ACTIVE_CLASS, active);
      };

      syncActiveClass();
      return {
        update() {
          syncActiveClass();
        },
        destroy() {
          view.dom.classList.remove(TEXT_SELECTION_OVERLAY_ACTIVE_CLASS);
        },
      };
    },
  });
});
