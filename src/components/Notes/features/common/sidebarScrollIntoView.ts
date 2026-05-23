function escapeAttributeValue(value: string) {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }

  return value.replace(/["\\]/g, '\\$&');
}

const SIDEBAR_SCROLL_TO_PATH_EVENT = 'notes-sidebar-scroll-to-path';
let suppressedCurrentNoteRevealPath: string | null = null;
let suppressedSidebarScrollTop: number | null = null;
let suppressedCurrentNoteRevealClearTimer: number | null = null;
const SUPPRESSED_CURRENT_NOTE_REVEAL_TTL_MS = 5000;

export interface SidebarScrollToPathDetail {
  path: string;
  block: ScrollLogicalPosition;
}

export function scrollSidebarItemIntoView(path: string, block: ScrollLogicalPosition = 'center'): boolean {
  const scrollRoot = document.querySelector<HTMLElement>('[data-notes-sidebar-scroll-root="true"]');
  if (!scrollRoot) {
    return false;
  }

  const escapedPath = escapeAttributeValue(path);
  const findTreeTarget = (root: ParentNode) =>
    Array.from(root.querySelectorAll<HTMLElement>(`[data-file-tree-path="${escapedPath}"]`))
      .find((element) => !element.closest('[data-file-tree-starred-section="true"]')) ?? null;
  const primaryTrees = Array.from(
    scrollRoot.querySelectorAll<HTMLElement>('[data-file-tree-primary="true"]')
  );
  const target = primaryTrees.length > 0
    ? primaryTrees
        .map((tree) => findTreeTarget(tree))
        .find((element): element is HTMLElement => element !== null) ?? null
    : findTreeTarget(scrollRoot);
  if (target) {
    target.scrollIntoView({
      block,
      behavior: 'smooth',
    });
    return true;
  }

  return !scrollRoot.dispatchEvent(
    new CustomEvent<SidebarScrollToPathDetail>(SIDEBAR_SCROLL_TO_PATH_EVENT, {
      cancelable: true,
      detail: { path, block },
    })
  );
}

export function scheduleSidebarItemIntoView(
  path: string,
  frameCount: number = 1,
  block: ScrollLogicalPosition = 'center'
) {
  const maxAttempts = 60;
  const run = (remainingFrames: number) => {
    if (remainingFrames <= 0) {
      let attempts = 0;
      const retry = () => {
        attempts += 1;
        if (scrollSidebarItemIntoView(path, block) || attempts >= maxAttempts) {
          return;
        }
        window.requestAnimationFrame(retry);
      };
      retry();
      return;
    }

    window.requestAnimationFrame(() => run(remainingFrames - 1));
  };

  run(frameCount);
}

function getSidebarScrollRoot(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-notes-sidebar-scroll-root="true"]');
}

export function suppressNextCurrentNoteSidebarReveal(path: string) {
  suppressedCurrentNoteRevealPath = path;
  suppressedSidebarScrollTop = getSidebarScrollRoot()?.scrollTop ?? null;
  if (suppressedCurrentNoteRevealClearTimer !== null) {
    window.clearTimeout(suppressedCurrentNoteRevealClearTimer);
  }
  suppressedCurrentNoteRevealClearTimer = window.setTimeout(() => {
    suppressedCurrentNoteRevealPath = null;
    suppressedSidebarScrollTop = null;
    suppressedCurrentNoteRevealClearTimer = null;
  }, SUPPRESSED_CURRENT_NOTE_REVEAL_TTL_MS);
}

function restoreSuppressedSidebarScrollTop(scrollRoot: HTMLElement | null | undefined) {
  if (!scrollRoot || suppressedSidebarScrollTop === null) {
    return;
  }

  const targetScrollTop = suppressedSidebarScrollTop;
  scrollRoot.scrollTo({ top: targetScrollTop, behavior: 'auto' });
  if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
    return;
  }

  window.requestAnimationFrame(() => {
    scrollRoot.scrollTo({ top: targetScrollTop, behavior: 'auto' });
  });
}

export function consumeSuppressedCurrentNoteSidebarReveal(
  path: string,
  scrollRoot?: HTMLElement | null,
): boolean {
  if (suppressedCurrentNoteRevealPath === null) {
    return false;
  }

  if (suppressedCurrentNoteRevealPath !== path) {
    return false;
  }

  restoreSuppressedSidebarScrollTop(scrollRoot ?? getSidebarScrollRoot());
  suppressedCurrentNoteRevealPath = null;
  suppressedSidebarScrollTop = null;
  if (suppressedCurrentNoteRevealClearTimer !== null) {
    window.clearTimeout(suppressedCurrentNoteRevealClearTimer);
    suppressedCurrentNoteRevealClearTimer = null;
  }
  return true;
}

export { SIDEBAR_SCROLL_TO_PATH_EVENT };
