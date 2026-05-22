import { AllSelection, Plugin, PluginKey, TextSelection, type EditorState } from '@milkdown/kit/prose/state';
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view';
import { $prose } from '@milkdown/kit/utils';
import { hasSelectedBlocks } from '../cursor/blockSelectionPluginState';
import { ATOMIC_TEXT_SELECTION_OVERLAY_NODE_NAMES } from '../shared/blockNodeTypes';

export const TEXT_SELECTION_OVERLAY_CLASS = 'vlaina-text-selection-overlay';
const TEXT_SELECTION_OVERLAY_ACTIVE_CLASS = 'vlaina-text-selection-overlay-active';
const POINTER_NATIVE_SELECTION_CLASS = 'vlaina-pointer-native-selection';
const POINTER_NATIVE_SELECTION_META = 'vlainaTextSelectionPointerNative';

interface TextSelectionOverlayState {
  decorations: DecorationSet;
  decorationCount: number;
  usePointerNativeSelection: boolean;
}

const textSelectionOverlayPluginKey = new PluginKey<TextSelectionOverlayState>('vlainaTextSelectionOverlay');
const NAVIGATION_KEYS_THAT_CLEAR_NATIVE_SELECTION = new Set([
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'End',
  'Home',
  'PageDown',
  'PageUp',
]);

function getNativeSelectionMetrics() {
  if (typeof window === 'undefined') {
    return null;
  }

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);
  const rects = Array.from(range.getClientRects());
  const firstRect = rects[0];
  const lastRect = rects[rects.length - 1];

  return {
    anchorOffset: selection.anchorOffset,
    focusOffset: selection.focusOffset,
    isCollapsed: selection.isCollapsed,
    rectCount: rects.length,
    firstHeight: firstRect ? Math.round(firstRect.height * 100) / 100 : null,
    lastHeight: lastRect ? Math.round(lastRect.height * 100) / 100 : null,
    firstTop: firstRect ? Math.round(firstRect.top * 100) / 100 : null,
    lastTop: lastRect ? Math.round(lastRect.top * 100) / 100 : null,
  };
}

function clearNativeSelectionRange(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.getSelection()?.removeAllRanges();
}

function isTextSelectionOverlayEligible(state: EditorState): boolean {
  const { selection } = state;
  if (selection.empty) return false;
  if (!(selection instanceof TextSelection) && !(selection instanceof AllSelection)) return false;
  if (hasSelectedBlocks(state)) return false;
  return true;
}

function createTextSelectionDecorationState(
  state: EditorState,
  usePointerNativeSelection = false
): Pick<TextSelectionOverlayState, 'decorationCount' | 'decorations'> {
  const { doc, selection } = state;
  if (usePointerNativeSelection) {
    return { decorationCount: 0, decorations: DecorationSet.empty };
  }
  if (!isTextSelectionOverlayEligible(state)) {
    return { decorationCount: 0, decorations: DecorationSet.empty };
  }

  const decorations: Decoration[] = [];
  doc.nodesBetween(selection.from, selection.to, (node, pos) => {
    if (
      selection instanceof AllSelection &&
      ATOMIC_TEXT_SELECTION_OVERLAY_NODE_NAMES.has(node.type.name) &&
      selection.from <= pos &&
      pos + node.nodeSize <= selection.to
    ) {
      decorations.push(Decoration.node(pos, pos + node.nodeSize, {
        class: 'vlaina-block-selected vlaina-atomic-selected',
      }));
      return false;
    }

    if (!node.isText) return;

    const from = Math.max(selection.from, pos);
    const to = Math.min(selection.to, pos + node.nodeSize);
    if (to <= from) return;

    decorations.push(Decoration.inline(from, to, {
      class: TEXT_SELECTION_OVERLAY_CLASS,
    }));
  });

  return {
    decorationCount: decorations.length,
    decorations: decorations.length > 0 ? DecorationSet.create(doc, decorations) : DecorationSet.empty,
  };
}

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
        const decorationState = createTextSelectionDecorationState(newState, usePointerNativeSelection);
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
    view(view) {
      let lastClassSignature = '';
      let keyClearFrame: number | null = null;
      let pointerNativeReleaseFrame: number | null = null;
      let recoverNativeSelectionFrame: number | null = null;

      const setPointerNativeSelection = (nextValue: boolean) => {
        const currentValue = Boolean(
          textSelectionOverlayPluginKey.getState(view.state)?.usePointerNativeSelection
        );
        if (currentValue === nextValue) return;
        view.dispatch(
          view.state.tr
            .setMeta(POINTER_NATIVE_SELECTION_META, nextValue)
            .setMeta('addToHistory', false)
        );
      };

      const scheduleRecoverNativeSelection = () => {
        if (recoverNativeSelectionFrame !== null) return;

        recoverNativeSelectionFrame = requestAnimationFrame(() => {
          recoverNativeSelectionFrame = null;
          const nativeSelection = getNativeSelectionMetrics();
          const shouldRecover =
            view.state.selection instanceof TextSelection &&
            !view.state.selection.empty &&
            nativeSelection &&
            !nativeSelection.isCollapsed &&
            nativeSelection.rectCount > 0 &&
            !textSelectionOverlayPluginKey.getState(view.state)?.usePointerNativeSelection;

          if (!shouldRecover) {
            const shouldClearNativeRangeForOverlay =
              view.state.selection instanceof AllSelection &&
              nativeSelection &&
              !nativeSelection.isCollapsed &&
              nativeSelection.rectCount > 0 &&
              !textSelectionOverlayPluginKey.getState(view.state)?.usePointerNativeSelection;

            if (shouldClearNativeRangeForOverlay) {
              clearNativeSelectionRange();
            }
            return;
          }

          setPointerNativeSelection(true);
          syncActiveClass();
        });
      };

      const syncActiveClass = () => {
        const pluginState = textSelectionOverlayPluginKey.getState(view.state);
        const usePointerNativeSelection = Boolean(pluginState?.usePointerNativeSelection);
        const active = !usePointerNativeSelection && isTextSelectionOverlayEligible(view.state);
        view.dom.classList.toggle(TEXT_SELECTION_OVERLAY_ACTIVE_CLASS, active);
        view.dom.classList.toggle(POINTER_NATIVE_SELECTION_CLASS, usePointerNativeSelection);
        const classSignature = [
          active ? 'overlay-active' : 'overlay-inactive',
          usePointerNativeSelection ? 'native-active' : 'native-inactive',
          pluginState?.decorationCount ?? 0,
        ].join(':');
        if (classSignature !== lastClassSignature) {
          lastClassSignature = classSignature;
          const nativeSelection = getNativeSelectionMetrics();
          if (
            active &&
            nativeSelection &&
            !nativeSelection.isCollapsed &&
            nativeSelection.rectCount > 0
          ) {
            scheduleRecoverNativeSelection();
          }
        }
      };

      const handleMouseDown = (event: MouseEvent) => {
        if (event.button !== 0) return;
        setPointerNativeSelection(true);
        syncActiveClass();
      };

      const handleKeyDown = (event: KeyboardEvent) => {
        const shouldClearForKey =
          event.key === 'Escape' ||
          NAVIGATION_KEYS_THAT_CLEAR_NATIVE_SELECTION.has(event.key);

        if (!shouldClearForKey) {
          return;
        }

        if (keyClearFrame !== null) {
          cancelAnimationFrame(keyClearFrame);
        }

        keyClearFrame = requestAnimationFrame(() => {
          keyClearFrame = null;
          setPointerNativeSelection(false);
          syncActiveClass();
        });
      };

      const handleMouseUp = () => {
        if (pointerNativeReleaseFrame !== null) {
          cancelAnimationFrame(pointerNativeReleaseFrame);
        }

        pointerNativeReleaseFrame = requestAnimationFrame(() => {
          pointerNativeReleaseFrame = null;
          const usePointerNativeSelection = Boolean(
            textSelectionOverlayPluginKey.getState(view.state)?.usePointerNativeSelection
          );
          if (!usePointerNativeSelection) return;

          if (isTextSelectionOverlayEligible(view.state)) {
            clearNativeSelectionRange();
            setPointerNativeSelection(false);
            syncActiveClass();
            return;
          }

          const nativeSelection = getNativeSelectionMetrics();
          if (view.state.selection.empty && (!nativeSelection || nativeSelection.isCollapsed)) {
            setPointerNativeSelection(false);
            syncActiveClass();
          }
        });
      };

      view.dom.addEventListener('mousedown', handleMouseDown);
      view.dom.addEventListener('keydown', handleKeyDown);
      document.addEventListener('mouseup', handleMouseUp);
      syncActiveClass();
      return {
        update() {
          syncActiveClass();
        },
        destroy() {
          if (keyClearFrame !== null) {
            cancelAnimationFrame(keyClearFrame);
          }
          if (pointerNativeReleaseFrame !== null) {
            cancelAnimationFrame(pointerNativeReleaseFrame);
          }
          if (recoverNativeSelectionFrame !== null) {
            cancelAnimationFrame(recoverNativeSelectionFrame);
          }
          view.dom.removeEventListener('mousedown', handleMouseDown);
          view.dom.removeEventListener('keydown', handleKeyDown);
          document.removeEventListener('mouseup', handleMouseUp);
          view.dom.classList.remove(TEXT_SELECTION_OVERLAY_ACTIVE_CLASS);
          view.dom.classList.remove(POINTER_NATIVE_SELECTION_CLASS);
        },
      };
    },
  });
});
