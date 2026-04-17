import type { EditorView } from '@milkdown/kit/prose/view';
import { getCurrentEditorView } from '../Editor/utils/editorViewRegistry';
import {
  clearEditorFind,
  getEditorFindState,
  setEditorFindActiveIndex,
  setEditorFindQuery,
} from '../Editor/plugins/find';

export interface SidebarSearchNavigationTarget {
  query: string;
  contentMatchOrdinal: number | null;
  path?: string;
  previousView?: EditorView | null;
  shouldContinue?: () => boolean;
}

let pendingSidebarSearchNavigationPath: string | null = null;
let activeSidebarSearchQuery: string | null = null;
const pendingNavigationListeners = new Set<() => void>();

function publishPendingSidebarSearchNavigationPath(path: string | null) {
  pendingSidebarSearchNavigationPath = path;
  pendingNavigationListeners.forEach((listener) => {
    listener();
  });
}

export function markSidebarSearchNavigationPending(path: string) {
  publishPendingSidebarSearchNavigationPath(path);
}

export function clearSidebarSearchNavigationPending(path?: string | null) {
  if (path == null || pendingSidebarSearchNavigationPath === path) {
    publishPendingSidebarSearchNavigationPath(null);
  }
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

export function getSidebarSearchNavigationPendingPath() {
  return pendingSidebarSearchNavigationPath;
}

export function subscribeSidebarSearchNavigationPending(listener: () => void) {
  pendingNavigationListeners.add(listener);
  return () => {
    pendingNavigationListeners.delete(listener);
  };
}

async function waitForNextFrame(frameCount = 1) {
  for (let frame = 0; frame < frameCount; frame += 1) {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  }
}

function shouldContinueNavigation(target: SidebarSearchNavigationTarget): boolean {
  return target.shouldContinue?.() ?? true;
}

export async function applySidebarSearchNavigation(target: SidebarSearchNavigationTarget): Promise<boolean> {
  const trimmedQuery = target.query.trim();

  if (!trimmedQuery) {
    clearSidebarSearchNavigationPending(target.path);
    return false;
  }

  if (!shouldContinueNavigation(target)) {
    clearSidebarSearchNavigationPending(target.path);
    return false;
  }

  if (target.previousView) {
    await waitForNextFrame(2);
    if (!shouldContinueNavigation(target)) {
      clearSidebarSearchNavigationPending(target.path);
      return false;
    }
  }

  for (let attempt = 0; attempt < 36; attempt += 1) {
    if (!shouldContinueNavigation(target)) {
      clearSidebarSearchNavigationPending(target.path);
      return false;
    }

    const view = getCurrentEditorView();
    if (!view) {
      await waitForNextFrame();
      continue;
    }

    if (!shouldContinueNavigation(target)) {
      clearSidebarSearchNavigationPending(target.path);
      return false;
    }

    setEditorFindQuery(view, trimmedQuery, 'instant');
    activeSidebarSearchQuery = trimmedQuery;
    const state = getEditorFindState(view);

    if (target.contentMatchOrdinal == null) {
      await waitForNextFrame(2);
      if (!shouldContinueNavigation(target)) {
        clearSidebarSearchNavigationPending(target.path);
        return false;
      }
      clearSidebarSearchNavigationPending(target.path);
      return true;
    }

    if (state && state.matches.length > 0) {
      const clampedOrdinal = Math.min(target.contentMatchOrdinal, state.matches.length - 1);
      setEditorFindActiveIndex(view, clampedOrdinal, 'instant');
      await waitForNextFrame(2);
      if (!shouldContinueNavigation(target)) {
        clearSidebarSearchNavigationPending(target.path);
        return false;
      }
      clearSidebarSearchNavigationPending(target.path);
      return true;
    }

    await waitForNextFrame();
  }

  clearSidebarSearchNavigationPending(target.path);
  activeSidebarSearchQuery = trimmedQuery;
  return false;
}
