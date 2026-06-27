import type { EditorView } from '@milkdown/kit/prose/view';
import {
  EMPTY_MATCHES,
  type EditorFindPluginState,
  type EditorFindSnapshot,
} from './editorFindState';

const listeners = new Set<() => void>();

let currentSnapshot: EditorFindSnapshot = {
  query: '',
  matches: EMPTY_MATCHES,
  activeIndex: -1,
  view: null,
  version: 0,
};

export function publishEditorFindSnapshot(
  view: EditorView | null,
  state: EditorFindPluginState | null,
) {
  const nextQuery = state?.query ?? '';
  const nextMatches = state?.matches.length ? state.matches : EMPTY_MATCHES;
  const nextActiveIndex = state?.activeIndex ?? -1;

  if (
    currentSnapshot.query === nextQuery &&
    currentSnapshot.matches === nextMatches &&
    currentSnapshot.activeIndex === nextActiveIndex &&
    currentSnapshot.view === view
  ) {
    return;
  }

  currentSnapshot = {
    query: nextQuery,
    matches: nextMatches,
    activeIndex: nextActiveIndex,
    view,
    version: currentSnapshot.version + 1,
  };

  listeners.forEach((listener) => listener());
}

export function subscribeEditorFindSnapshot(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getEditorFindSnapshot(): EditorFindSnapshot {
  return currentSnapshot;
}
