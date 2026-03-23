import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import type { FloatingToolbarState, ToolbarMeta } from './types';
import { getLinkUrl } from './selectionHelpers';
import { setLink, toggleMark } from './commands';
import { isFloatingToolbarSuppressed } from './floatingToolbarDom';
import { createFloatingToolbarPluginView } from './floatingToolbarPluginView';
import { applyToolbarMeta, createInitialState } from './floatingToolbarState';
import { openLinkTooltipFromSelection } from './linkTooltipActions';

export const floatingToolbarKey = new PluginKey<FloatingToolbarState>('floatingToolbar');

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
        const meta = tr.getMeta(floatingToolbarKey) as ToolbarMeta | undefined;
        const nextMetaState = applyToolbarMeta(prevState, meta);
        if (nextMetaState) {
          return nextMetaState;
        }

        if (tr.selectionSet) {
          const { selection } = newState;
          if (selection.empty) {
            if (prevState.isVisible) {
              if (interactionState.isPointerInsideToolbar) {
                return prevState;
              }

              return { ...prevState, isVisible: false, subMenu: null, copied: false };
            }
          } else {
            if (isFloatingToolbarSuppressed()) {
              if (prevState.isVisible) {
                return { ...prevState, isVisible: false, subMenu: null, copied: false };
              }

              return prevState;
            }

            if (!interactionState.isMouseDown && !prevState.isVisible) {
              return { ...prevState, isVisible: true };
            }

            if (interactionState.isMouseDown) {
              interactionState.pendingShow = true;
            }
          }
        }
        return prevState;
      },
    },
    view(editorView) {
      return createFloatingToolbarPluginView(editorView, floatingToolbarKey, interactionState);
    },
    props: {
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

              openLinkTooltipFromSelection(view);
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
