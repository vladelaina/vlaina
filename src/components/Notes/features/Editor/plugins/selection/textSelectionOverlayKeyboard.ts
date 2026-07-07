import {
  KEYBOARD_SELECTION_PENDING_CLASS,
  NAVIGATION_KEYS_THAT_CLEAR_NATIVE_SELECTION,
  isModifiedNavigationKey,
  isTextSelectionOverlayEligible,
  textSelectionOverlayPluginKey,
} from './textSelectionOverlayState';
import type { TextSelectionOverlayViewContext } from './textSelectionOverlayViewTypes';
import { clearKeyboardSelectionState, scheduleClearNativeSelection } from './textSelectionOverlayViewSync';

export function handleTextSelectionOverlayKeyDown(
  context: TextSelectionOverlayViewContext,
  event: KeyboardEvent
): void {
  const { session, view } = context;
  if (event.isComposing) {
    return;
  }

  const isModifiedNavigation =
    NAVIGATION_KEYS_THAT_CLEAR_NATIVE_SELECTION.has(event.key) &&
    isModifiedNavigationKey(event);
  const shouldSuppressInitialKeyboardSelection =
    isModifiedNavigation &&
    event.shiftKey &&
    view.state.selection.empty;

  if (isModifiedNavigation && event.shiftKey) {
    session.preserveNativeSelectionForKeyboard = true;
  }

  if (shouldSuppressInitialKeyboardSelection) {
    view.dom.classList.add(KEYBOARD_SELECTION_PENDING_CLASS);
    if (session.keyboardSelectionPendingCleanupTimeout !== null) {
      window.clearTimeout(session.keyboardSelectionPendingCleanupTimeout);
    }
    session.keyboardSelectionPendingCleanupTimeout = window.setTimeout(() => {
      session.keyboardSelectionPendingCleanupTimeout = null;
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
    scheduleClearNativeSelection(context);
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

  if (session.keyClearFrame !== null) {
    cancelAnimationFrame(session.keyClearFrame);
  }

  session.keyClearFrame = requestAnimationFrame(() => {
    session.keyClearFrame = null;
    clearKeyboardSelectionState(context);
  });
}
