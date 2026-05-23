function escapeAttributeValue(value: string) {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }

  return value.replace(/["\\]/g, '\\$&');
}

const SIDEBAR_SCROLL_TO_PATH_EVENT = 'notes-sidebar-scroll-to-path';

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
  const target = scrollRoot.querySelector<HTMLElement>(`[data-file-tree-path="${escapedPath}"]`);
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

export { SIDEBAR_SCROLL_TO_PATH_EVENT };
