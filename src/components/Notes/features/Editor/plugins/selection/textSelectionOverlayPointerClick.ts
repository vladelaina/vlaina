import { TextSelection } from '@milkdown/kit/prose/state';
import { floatingToolbarKey } from '../floating-toolbar/floatingToolbarKey';
import { TOOLBAR_ACTIONS } from '../floating-toolbar/types';
import {
  POINTER_NATIVE_SELECTION_META,
  clearNativeSelectionRange,
  textSelectionOverlayPluginKey,
} from './textSelectionOverlayState';
import { syncNativeSelectionToCaretTarget } from './textSelectionOverlayCaret';
import type { PointerCaretTarget, TextSelectionOverlayViewContext } from './textSelectionOverlayViewTypes';

export function collapsePointerNativeSelectionAt(
  { session, view }: TextSelectionOverlayViewContext,
  target: PointerCaretTarget
): void {
  const nextPos = Math.max(0, Math.min(view.state.doc.content.size, target.pos));
  const tr = view.state.tr
    .setSelection(TextSelection.create(view.state.doc, nextPos))
    .setMeta(floatingToolbarKey, {
      type: TOOLBAR_ACTIONS.HIDE,
    })
    .setMeta(POINTER_NATIVE_SELECTION_META, false)
    .setMeta('addToHistory', false)
    .scrollIntoView();
  view.dispatch(tr);
  if (!view.state.selection.eq(tr.selection)) {
    const nextState = view.state.apply(tr);
    view.updateState(nextState);
  }
  view.focus();
  syncNativeSelectionToCaretTarget(view, { ...target, pos: nextPos });
  session.syncActiveClass();
}

export function cancelPointerClickCollapseReassertion(
  { session }: TextSelectionOverlayViewContext
): void {
  if (session.pointerClickCollapseFrame !== null) {
    cancelAnimationFrame(session.pointerClickCollapseFrame);
    session.pointerClickCollapseFrame = null;
  }
  if (session.pointerClickCollapseTimeout !== null) {
    window.clearTimeout(session.pointerClickCollapseTimeout);
    session.pointerClickCollapseTimeout = null;
  }
}

function shouldReassertPointerClickCollapse(
  { session }: TextSelectionOverlayViewContext,
  target: PointerCaretTarget
) {
  return session.pendingPointerClickCollapseTarget === target && !session.pointerMovedSinceDown;
}

function reassertPointerClickCollapse(
  context: TextSelectionOverlayViewContext,
  target: PointerCaretTarget
) {
  if (!shouldReassertPointerClickCollapse(context, target)) return;
  collapsePointerNativeSelectionAt(context, target);
}

export function schedulePointerClickCollapseReassertion(
  context: TextSelectionOverlayViewContext,
  target: PointerCaretTarget
): void {
  const { session } = context;
  cancelPointerClickCollapseReassertion(context);

  queueMicrotask(() => {
    reassertPointerClickCollapse(context, target);
  });
  session.pointerClickCollapseFrame = requestAnimationFrame(() => {
    session.pointerClickCollapseFrame = null;
    reassertPointerClickCollapse(context, target);
  });
  session.pointerClickCollapseTimeout = window.setTimeout(() => {
    session.pointerClickCollapseTimeout = null;
    reassertPointerClickCollapse(context, target);
  }, 0);
}

export function clearTextSelectionFromBlankPointerDown(context: TextSelectionOverlayViewContext): void {
  const { session, view } = context;
  session.pendingPointerClickCollapseTarget = null;
  cancelPointerClickCollapseReassertion(context);
  if (session.pointerNativeReleaseFrame !== null) {
    cancelAnimationFrame(session.pointerNativeReleaseFrame);
    session.pointerNativeReleaseFrame = null;
  }

  const nextPos = Math.max(0, Math.min(view.state.selection.from, view.state.doc.content.size));
  let tr = view.state.tr
    .setSelection(TextSelection.create(view.state.doc, nextPos))
    .setMeta(POINTER_NATIVE_SELECTION_META, false)
    .setMeta('addToHistory', false);
  const toolbarState = floatingToolbarKey.getState(view.state);
  if (
    toolbarState?.isVisible &&
    !(toolbarState.subMenu === 'aiReview' && toolbarState.aiReview)
  ) {
    tr = tr.setMeta(floatingToolbarKey, {
      type: TOOLBAR_ACTIONS.HIDE,
    });
  }
  view.dispatch(tr);
  clearNativeSelectionRange();
  session.syncActiveClass();
}

export function getPointerNativeSelectionEnabled({ view }: TextSelectionOverlayViewContext): boolean {
  return Boolean(
    textSelectionOverlayPluginKey.getState(view.state)?.usePointerNativeSelection
  );
}
