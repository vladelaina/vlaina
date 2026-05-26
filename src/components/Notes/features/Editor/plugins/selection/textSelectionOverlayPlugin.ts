import { AllSelection, Plugin, PluginKey, TextSelection, type EditorState } from '@milkdown/kit/prose/state';
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view';
import { $prose } from '@milkdown/kit/utils';
import { hasSelectedBlocks } from '../cursor/blockSelectionPluginState';
import { ATOMIC_TEXT_SELECTION_OVERLAY_NODE_NAMES } from '../shared/blockNodeTypes';

export const TEXT_SELECTION_OVERLAY_CLASS = 'vlaina-text-selection-overlay';
const TEXT_SELECTION_OVERLAY_ACTIVE_CLASS = 'vlaina-text-selection-overlay-active';
const POINTER_NATIVE_SELECTION_CLASS = 'vlaina-pointer-native-selection';
const KEYBOARD_SELECTION_PENDING_CLASS = 'vlaina-keyboard-selection-pending';
const POINTER_NATIVE_SELECTION_META = 'vlainaTextSelectionPointerNative';
const EDITOR_ONLY_TEXT_SELECTION_PLACEHOLDERS = new Set(['\u200B', '\u200C', '\u2800']);
const VISIBLE_TEXT_PATTERN = /\S/u;
const LINE_BREAK_PATTERN = /[\n\r\u2028\u2029]/u;

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

function isModifiedNavigationKey(event: KeyboardEvent): boolean {
  return event.shiftKey || event.ctrlKey || event.metaKey || event.altKey;
}

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

  return {
    isCollapsed: selection.isCollapsed,
    rectCount: rects.length,
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

export function addTextSelectionOverlayDecorations(
  decorations: Decoration[],
  text: string,
  nodeStart: number,
  selectionFrom: number,
  selectionTo: number
): void {
  const from = Math.max(selectionFrom, nodeStart);
  const to = Math.min(selectionTo, nodeStart + text.length);
  if (to <= from) return;

  const pushVisibleDecoration = (rangeFrom: number, rangeTo: number) => {
    if (rangeTo <= rangeFrom) return;
    const selectedText = text.slice(rangeFrom - nodeStart, rangeTo - nodeStart);
    if (!VISIBLE_TEXT_PATTERN.test(selectedText)) {
      return;
    }
    decorations.push(Decoration.inline(rangeFrom, rangeTo, {
      class: TEXT_SELECTION_OVERLAY_CLASS,
    }));
  };

  let rangeStart: number | null = null;
  for (let pos = from; pos < to; pos += 1) {
    const char = text[pos - nodeStart];
    if (EDITOR_ONLY_TEXT_SELECTION_PLACEHOLDERS.has(char)) {
      if (rangeStart !== null) {
        pushVisibleDecoration(rangeStart, pos);
      }
      rangeStart = null;
      continue;
    }
    if (LINE_BREAK_PATTERN.test(char)) {
      if (rangeStart !== null) {
        pushVisibleDecoration(rangeStart, pos);
      }
      rangeStart = null;
      continue;
    }

    rangeStart ??= pos;
  }

  if (rangeStart !== null && to > rangeStart) {
    pushVisibleDecoration(rangeStart, to);
  }
}

function createTextSelectionDecorationState(
  state: EditorState
): Pick<TextSelectionOverlayState, 'decorationCount' | 'decorations'> {
  const { doc, selection } = state;
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
    addTextSelectionOverlayDecorations(
      decorations,
      node.text ?? '',
      pos,
      selection.from,
      selection.to
    );
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
        const decorationState = createTextSelectionDecorationState(newState);
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
      let clearNativeSelectionFrame: number | null = null;
      let keyboardSelectionPendingCleanupTimeout: number | null = null;
      let isPointerSelectionActive = false;
      let preserveNativeSelectionForKeyboard = false;

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

      const scheduleClearNativeSelection = () => {
        if (clearNativeSelectionFrame !== null) return;

        clearNativeSelectionFrame = requestAnimationFrame(() => {
          clearNativeSelectionFrame = null;
          const nativeSelection = getNativeSelectionMetrics();
          const shouldClearNativeRangeForOverlay =
            !isPointerSelectionActive &&
            !preserveNativeSelectionForKeyboard &&
            isTextSelectionOverlayEligible(view.state) &&
            nativeSelection &&
            !nativeSelection.isCollapsed &&
            nativeSelection.rectCount > 0 &&
            !textSelectionOverlayPluginKey.getState(view.state)?.usePointerNativeSelection;

          if (shouldClearNativeRangeForOverlay) {
            clearNativeSelectionRange();
          }
        });
      };

      const syncActiveClass = () => {
        const pluginState = textSelectionOverlayPluginKey.getState(view.state);
        const usePointerNativeSelection = Boolean(pluginState?.usePointerNativeSelection);
        const active = isTextSelectionOverlayEligible(view.state);
        if (!active) {
          preserveNativeSelectionForKeyboard = false;
        }
        view.dom.classList.toggle(TEXT_SELECTION_OVERLAY_ACTIVE_CLASS, active);
        view.dom.classList.toggle(POINTER_NATIVE_SELECTION_CLASS, usePointerNativeSelection);
        if (active || !usePointerNativeSelection) {
          view.dom.classList.remove(KEYBOARD_SELECTION_PENDING_CLASS);
        }
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
            scheduleClearNativeSelection();
          }
        }
      };

      const handleMouseDown = (event: MouseEvent) => {
        if (event.button !== 0) return;
        preserveNativeSelectionForKeyboard = false;
        isPointerSelectionActive = true;
        setPointerNativeSelection(true);
        syncActiveClass();
      };

      const handleKeyDown = (event: KeyboardEvent) => {
        const isModifiedNavigation =
          NAVIGATION_KEYS_THAT_CLEAR_NATIVE_SELECTION.has(event.key) &&
          isModifiedNavigationKey(event);
        const shouldSuppressInitialKeyboardSelection =
          isModifiedNavigation &&
          event.shiftKey &&
          view.state.selection.empty;

        if (isModifiedNavigation && event.shiftKey) {
          preserveNativeSelectionForKeyboard = true;
        }

        if (shouldSuppressInitialKeyboardSelection) {
          view.dom.classList.add(KEYBOARD_SELECTION_PENDING_CLASS);
          if (keyboardSelectionPendingCleanupTimeout !== null) {
            window.clearTimeout(keyboardSelectionPendingCleanupTimeout);
          }
          keyboardSelectionPendingCleanupTimeout = window.setTimeout(() => {
            keyboardSelectionPendingCleanupTimeout = null;
            if (!isTextSelectionOverlayEligible(view.state)) {
              view.dom.classList.remove(KEYBOARD_SELECTION_PENDING_CLASS);
            }
          }, 160);
        }

        if (
          isModifiedNavigation &&
          isTextSelectionOverlayEligible(view.state) &&
          !textSelectionOverlayPluginKey.getState(view.state)?.usePointerNativeSelection
        ) {
          scheduleClearNativeSelection();
          return;
        }

        const shouldClearForKey =
          event.key === 'Escape' ||
          (
            NAVIGATION_KEYS_THAT_CLEAR_NATIVE_SELECTION.has(event.key) &&
            !isModifiedNavigationKey(event)
          );

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
        isPointerSelectionActive = false;
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

        if (isTextSelectionOverlayEligible(view.state)) {
          scheduleClearNativeSelection();
        }
      };

      const handleWindowBlur = () => {
        isPointerSelectionActive = false;
        preserveNativeSelectionForKeyboard = false;
        setPointerNativeSelection(false);
        syncActiveClass();
        if (isTextSelectionOverlayEligible(view.state)) {
          scheduleClearNativeSelection();
        }
      };

      view.dom.addEventListener('mousedown', handleMouseDown);
      view.dom.addEventListener('keydown', handleKeyDown);
      document.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('blur', handleWindowBlur);
      syncActiveClass();
      return {
        update() {
          syncActiveClass();
        },
        destroy() {
          if (keyClearFrame !== null) {
            cancelAnimationFrame(keyClearFrame);
          }
          if (keyboardSelectionPendingCleanupTimeout !== null) {
            window.clearTimeout(keyboardSelectionPendingCleanupTimeout);
            keyboardSelectionPendingCleanupTimeout = null;
          }
          view.dom.classList.remove(KEYBOARD_SELECTION_PENDING_CLASS);
          if (pointerNativeReleaseFrame !== null) {
            cancelAnimationFrame(pointerNativeReleaseFrame);
          }
          if (clearNativeSelectionFrame !== null) {
            cancelAnimationFrame(clearNativeSelectionFrame);
          }
          view.dom.removeEventListener('mousedown', handleMouseDown);
          view.dom.removeEventListener('keydown', handleKeyDown);
          document.removeEventListener('mouseup', handleMouseUp);
          window.removeEventListener('blur', handleWindowBlur);
          view.dom.classList.remove(TEXT_SELECTION_OVERLAY_ACTIVE_CLASS);
          view.dom.classList.remove(POINTER_NATIVE_SELECTION_CLASS);
          view.dom.classList.remove(KEYBOARD_SELECTION_PENDING_CLASS);
        },
      };
    },
  });
});
