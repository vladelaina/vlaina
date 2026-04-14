import type { EditorView } from '@milkdown/kit/prose/view';
import { getCurrentEditorView } from '../Editor/utils/editorViewRegistry';
import {
  clearEditorFind,
  getEditorFindState,
  setEditorFindActiveIndex,
  setEditorFindQuery,
} from '../Editor/plugins/find';
import {
  getSidebarSearchDebugScrollMeta,
  getSidebarSearchDebugViewMeta,
  logSidebarSearchDebug,
} from './sidebarSearchDebug';

export interface SidebarSearchNavigationTarget {
  query: string;
  contentMatchOrdinal: number | null;
  path?: string;
  previousView?: EditorView | null;
}

let pendingSidebarSearchNavigationPath: string | null = null;
let activeSidebarSearchQuery: string | null = null;

function getViewScrollRoot(view: EditorView): HTMLElement | null {
  return view.dom.closest('[data-note-scroll-root="true"]') as HTMLElement | null;
}

export function markSidebarSearchNavigationPending(path: string) {
  pendingSidebarSearchNavigationPath = path;
  logSidebarSearchDebug('navigation:pending:mark', {
    path,
    pendingPath: pendingSidebarSearchNavigationPath,
  });
}

export function clearSidebarSearchNavigationPending(path?: string | null) {
  const previousPath = pendingSidebarSearchNavigationPath;
  if (path == null || pendingSidebarSearchNavigationPath === path) {
    pendingSidebarSearchNavigationPath = null;
  }

  logSidebarSearchDebug('navigation:pending:clear', {
    requestedPath: path ?? null,
    previousPath,
    pendingPath: pendingSidebarSearchNavigationPath,
  });
}

export function isSidebarSearchNavigationPending(path: string | null | undefined) {
  return Boolean(path && pendingSidebarSearchNavigationPath === path);
}

export function clearSidebarSearchHighlights() {
  const view = getCurrentEditorView();
  if (view && activeSidebarSearchQuery != null) {
    const state = getEditorFindState(view);
    if (state?.query === activeSidebarSearchQuery) {
      clearEditorFind(view);
    }
  }

  activeSidebarSearchQuery = null;
}

async function waitForNextFrame(frameCount = 1) {
  for (let frame = 0; frame < frameCount; frame += 1) {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  }
}

export async function applySidebarSearchNavigation(target: SidebarSearchNavigationTarget): Promise<boolean> {
  const trimmedQuery = target.query.trim();
  logSidebarSearchDebug('navigation:apply:start', {
    path: target.path ?? null,
    query: trimmedQuery,
    contentMatchOrdinal: target.contentMatchOrdinal,
    previousView: getSidebarSearchDebugViewMeta(target.previousView),
    currentView: getSidebarSearchDebugViewMeta(getCurrentEditorView()),
  });

  if (!trimmedQuery) {
    clearSidebarSearchNavigationPending(target.path);
    logSidebarSearchDebug('navigation:apply:abort-empty-query', {
      path: target.path ?? null,
    });
    return false;
  }

  if (target.previousView) {
    logSidebarSearchDebug('navigation:apply:wait-for-next-view:start', {
      path: target.path ?? null,
      previousView: getSidebarSearchDebugViewMeta(target.previousView),
    });
    await waitForNextFrame(2);
    logSidebarSearchDebug('navigation:apply:wait-for-next-view:end', {
      path: target.path ?? null,
      currentView: getSidebarSearchDebugViewMeta(getCurrentEditorView()),
    });
  }

  for (let attempt = 0; attempt < 36; attempt += 1) {
    const view = getCurrentEditorView();
    if (!view) {
      logSidebarSearchDebug('navigation:apply:attempt:no-view', {
        path: target.path ?? null,
        attempt,
      });
      await waitForNextFrame();
      continue;
    }

    const scrollRoot = getViewScrollRoot(view);
    const isPreviousView = Boolean(target.previousView && view === target.previousView);

    setEditorFindQuery(view, trimmedQuery, 'instant');
    activeSidebarSearchQuery = trimmedQuery;
    const state = getEditorFindState(view);

    logSidebarSearchDebug('navigation:apply:attempt', {
      path: target.path ?? null,
      attempt,
      requestedOrdinal: target.contentMatchOrdinal,
      isPreviousView,
      view: getSidebarSearchDebugViewMeta(view),
      scrollRoot: getSidebarSearchDebugScrollMeta(scrollRoot),
      query: state?.query ?? null,
      matchCount: state?.matches.length ?? null,
      activeIndex: state?.activeIndex ?? null,
    });

    if (target.contentMatchOrdinal == null) {
      clearSidebarSearchNavigationPending(target.path);
      logSidebarSearchDebug('navigation:apply:success-query-only', {
        path: target.path ?? null,
        attempt,
        view: getSidebarSearchDebugViewMeta(view),
        scrollRoot: getSidebarSearchDebugScrollMeta(scrollRoot),
      });
      return true;
    }

    if (state && state.matches.length > 0) {
      const clampedOrdinal = Math.min(target.contentMatchOrdinal, state.matches.length - 1);
      setEditorFindActiveIndex(view, clampedOrdinal, 'instant');
      clearSidebarSearchNavigationPending(target.path);
      logSidebarSearchDebug('navigation:apply:success-match', {
        path: target.path ?? null,
        attempt,
        requestedOrdinal: target.contentMatchOrdinal,
        activeIndex: clampedOrdinal,
        view: getSidebarSearchDebugViewMeta(view),
        scrollRoot: getSidebarSearchDebugScrollMeta(scrollRoot),
      });
      return true;
    }

    await waitForNextFrame();
  }

  clearSidebarSearchNavigationPending(target.path);
  activeSidebarSearchQuery = trimmedQuery;
  logSidebarSearchDebug('navigation:apply:failed-timeout', {
    path: target.path ?? null,
    query: trimmedQuery,
    contentMatchOrdinal: target.contentMatchOrdinal,
    currentView: getSidebarSearchDebugViewMeta(getCurrentEditorView()),
  });
  return false;
}
