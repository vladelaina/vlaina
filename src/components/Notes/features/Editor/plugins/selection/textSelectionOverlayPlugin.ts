import { Plugin, TextSelection } from '@milkdown/kit/prose/state';
import { DecorationSet } from '@milkdown/kit/prose/view';
import { $prose } from '@milkdown/kit/utils';
import { createTextSelectionDecorationState } from './textSelectionOverlayDecorations';
import { createTextSelectionOverlayPluginView } from './textSelectionOverlayPluginView';
import {
  POINTER_NATIVE_SELECTION_META,
  textSelectionOverlayPluginKey,
} from './textSelectionOverlayState';
import { getEmptyTextSelectionOverlayDecorationState } from './textSelectionOverlayViewSync';

export {
  addTextSelectionOverlayDecorations,
  addTextSelectionOverlayDecorationsForRange,
  createTextSelectionDecorationState,
} from './textSelectionOverlayDecorations';
export {
  MAX_TEXT_SELECTION_OVERLAY_DECORATIONS,
  MAX_TEXT_SELECTION_OVERLAY_SCAN_NODES,
  TEXT_SELECTION_OVERLAY_CLASS,
  getNativeSelectionMetrics,
  showTextSelectionOverlayForTransaction,
} from './textSelectionOverlayState';

export const textSelectionOverlayPlugin = $prose(() => {
  return new Plugin({
    key: textSelectionOverlayPluginKey,
    state: {
      init(_, state) {
        const decorationState = createTextSelectionDecorationState(state);
        return {
          ...decorationState,
          usePointerNativeSelection: false,
        };
      },
      apply(tr, previous, _oldState, newState) {
        const pointerNativeMeta = tr.getMeta(POINTER_NATIVE_SELECTION_META) as boolean | undefined;
        const usePointerNativeSelection = pointerNativeMeta ?? (
          newState.selection instanceof TextSelection
            ? tr.docChanged && newState.selection.empty ? false : previous.usePointerNativeSelection
            : false
        );
        if (!tr.docChanged && !tr.selectionSet && pointerNativeMeta === undefined) return previous;
        const decorationState = usePointerNativeSelection
          ? getEmptyTextSelectionOverlayDecorationState()
          : createTextSelectionDecorationState(newState);
        return {
          ...decorationState,
          usePointerNativeSelection,
        };
      },
    },
    props: {
      decorations(state) {
        return textSelectionOverlayPluginKey.getState(state)?.decorations ?? DecorationSet.empty;
      },
    },
    view: createTextSelectionOverlayPluginView,
  });
});
