import { $prose } from '@milkdown/kit/utils';
import { Plugin } from '@milkdown/kit/prose/state';
import type { FloatingToolbarState, ToolbarMeta } from './types';
import { getLinkUrl } from './selectionHelpers';
import { setLink, toggleMark } from './commands';
import { isFloatingToolbarSuppressed } from './floatingToolbarDom';
import { createFloatingToolbarPluginView } from './floatingToolbarPluginView';
import { applyToolbarMeta, createInitialState, mapAiReviewRange } from './floatingToolbarState';
import { floatingToolbarKey } from './floatingToolbarKey';
import { openLinkTooltipFromSelection } from './linkTooltipActions';
import { getAiReviewSelectionDecorations } from './ai/reviewSelection';

export const floatingToolbarPlugin = $prose(() => {
  const interactionState = {
    isMouseDown: false,
    pendingShow: false,
    isPointerInsideToolbar: false,
  };

  return new Plugin<FloatingToolbarState>({
    key: floatingToolbarKey,
    state: {
      init: () => createInitialState(),
      apply(tr, prevState, _oldState, newState) {
        const mappedState = tr.docChanged
          ? mapAiReviewRange(prevState, tr.mapping, newState.doc.content.size)
          : prevState;
        const meta = tr.getMeta(floatingToolbarKey) as ToolbarMeta | undefined;
        const nextMetaState = applyToolbarMeta(mappedState, meta);
        if (nextMetaState) {
          return nextMetaState;
        }

        if (tr.selectionSet) {
          const { selection } = newState;
          const isAiReviewPinned = mappedState.subMenu === 'aiReview' && Boolean(mappedState.aiReview);
          if (selection.empty) {
            if (mappedState.isVisible) {
              if (isAiReviewPinned) {
                return mappedState;
              }

              if (interactionState.isPointerInsideToolbar) {
                return mappedState;
              }

              return { ...mappedState, isVisible: false, subMenu: null, copied: false };
            }
          } else {
            if (isFloatingToolbarSuppressed()) {
              if (isAiReviewPinned) {
                return mappedState;
              }

              if (mappedState.isVisible) {
                return { ...mappedState, isVisible: false, subMenu: null, copied: false };
              }

              return mappedState;
            }

            if (!interactionState.isMouseDown && !mappedState.isVisible) {
              return { ...mappedState, isVisible: true };
            }

            if (interactionState.isMouseDown) {
              interactionState.pendingShow = true;
            }
          }
        }
        return mappedState;
      },
    },
    view(editorView) {
      return createFloatingToolbarPluginView(editorView, floatingToolbarKey, interactionState);
    },
    props: {
      decorations(state) {
        return getAiReviewSelectionDecorations(state);
      },
      handleKeyDown(view, event) {
        const isMod = event.ctrlKey || event.metaKey;
        if (isMod && !event.shiftKey) {
          const { selection } = view.state;
          if (selection.empty) return false;
          switch (event.key.toLowerCase()) {
            case 'b': event.preventDefault(); toggleMark(view, 'strong'); return true;
            case 'i': event.preventDefault(); toggleMark(view, 'emphasis'); return true;
            case 'u': event.preventDefault(); toggleMark(view, 'underline'); return true;
            case 'k': {
              event.preventDefault();
              const linkUrl = getLinkUrl(view);
              if (linkUrl !== null && linkUrl !== '') {
                setLink(view, null);
                return true;
              }

              openLinkTooltipFromSelection(view, { autoFocus: true });
              return true;
            }
            case 'h': event.preventDefault(); toggleMark(view, 'highlight'); return true;
          }
        }
        return false;
      },
    },
  });
});
