import type { EditorView } from '@milkdown/kit/prose/view';
import {
  resolveEditorFindStartIndex,
  type EditorFindMatch,
} from './editorFindMatches';
import { editorFindPluginKey } from './editorFindKey';
import { revealEditorFindMatch } from './editorFindReveal';
import type { EditorFindPluginMeta, EditorFindPluginState } from './editorFindState';

function getScrollRoot(view: EditorView): HTMLElement | null {
  return view.dom.closest('[data-note-scroll-root="true"]') as HTMLElement | null;
}

function scrollEditorFindMatchIntoView(view: EditorView, match: EditorFindMatch) {
  requestAnimationFrame(() => {
    try {
      const startRect = view.coordsAtPos(match.from);
      const endRect = view.coordsAtPos(Math.max(match.to - 1, match.from));
      const top = Math.min(startRect.top, endRect.top);
      const bottom = Math.max(startRect.bottom, endRect.bottom);
      const scrollRoot = getScrollRoot(view);

      if (scrollRoot) {
        const rootRect = scrollRoot.getBoundingClientRect();
        const padding = 96;

        if (top >= rootRect.top + padding && bottom <= rootRect.bottom - padding) {
          return;
        }

        const centeredOffset =
          scrollRoot.scrollTop +
          top -
          rootRect.top -
          Math.max(32, (scrollRoot.clientHeight - (bottom - top)) / 2);

        scrollRoot.scrollTo({
          top: Math.max(centeredOffset, 0),
          behavior: 'smooth',
        });
        return;
      }

      const viewportPadding = 96;
      if (top >= viewportPadding && bottom <= window.innerHeight - viewportPadding) {
        return;
      }

      window.scrollBy({
        top: top - Math.max(32, (window.innerHeight - (bottom - top)) / 2),
        behavior: 'smooth',
      });
    } catch {
    }
  });
}

function maybeScrollToActiveMatch(view: EditorView) {
  const state = getEditorFindState(view);
  if (!state || state.activeIndex < 0) {
    return;
  }

  const activeMatch = state.matches[state.activeIndex];
  if (!activeMatch) {
    return;
  }

  revealEditorFindMatch(view, activeMatch);
  scrollEditorFindMatchIntoView(view, activeMatch);
}

function dispatchEditorFindMeta(view: EditorView, meta: EditorFindPluginMeta) {
  view.dispatch(view.state.tr.setMeta(editorFindPluginKey, meta));
  return getEditorFindState(view);
}

export function getEditorFindState(view: EditorView): EditorFindPluginState | undefined {
  try {
    return editorFindPluginKey.getState(view.state);
  } catch {
    return undefined;
  }
}

export function setEditorFindQuery(view: EditorView, query: string) {
  const state = getEditorFindState(view);
  const preferredFrom =
    state && state.query.length > 0 && state.activeIndex >= 0
      ? state.matches[state.activeIndex]?.from ?? 0
      : 0;

  dispatchEditorFindMeta(view, {
    type: 'set-query',
    query,
    preferredFrom,
  });
  maybeScrollToActiveMatch(view);
}

export function clearEditorFind(view: EditorView) {
  dispatchEditorFindMeta(view, { type: 'clear' });
}

export function stepEditorFindMatch(view: EditorView, delta: number) {
  const state = getEditorFindState(view);
  if (!state || state.matches.length === 0) {
    return;
  }

  const currentIndex =
    state.activeIndex === -1
      ? resolveEditorFindStartIndex(state.matches, view.state.selection.from)
      : state.activeIndex;
  const nextIndex = currentIndex + delta;

  dispatchEditorFindMeta(view, {
    type: 'set-active-index',
    activeIndex: nextIndex,
  });
  maybeScrollToActiveMatch(view);
}

export function replaceCurrentEditorFindMatch(view: EditorView, replacement: string): boolean {
  const state = getEditorFindState(view);
  if (!state || state.activeIndex < 0) {
    return false;
  }

  const activeMatch = state.matches[state.activeIndex];
  if (!activeMatch) {
    return false;
  }

  const tr = view.state.tr.insertText(replacement, activeMatch.from, activeMatch.to);
  tr.setMeta(editorFindPluginKey, {
    type: 'set-query',
    query: state.query,
    preferredFrom: activeMatch.from + replacement.length,
  } as EditorFindPluginMeta);

  view.dispatch(tr);
  maybeScrollToActiveMatch(view);
  return true;
}

export function replaceAllEditorFindMatches(view: EditorView, replacement: string): number {
  const state = getEditorFindState(view);
  if (!state || state.matches.length === 0) {
    return 0;
  }

  let tr = view.state.tr;
  for (let index = state.matches.length - 1; index >= 0; index -= 1) {
    const match = state.matches[index];
    tr = tr.insertText(replacement, match.from, match.to);
  }

  tr.setMeta(editorFindPluginKey, {
    type: 'set-query',
    query: state.query,
    preferredFrom: state.matches[0].from,
  } as EditorFindPluginMeta);

  view.dispatch(tr);
  maybeScrollToActiveMatch(view);
  return state.matches.length;
}
