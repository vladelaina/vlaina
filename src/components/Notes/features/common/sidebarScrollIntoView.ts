function escapeAttributeValue(value: string) {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }

  return value.replace(/["\\]/g, '\\$&');
}

export function scrollSidebarItemIntoView(path: string, block: ScrollLogicalPosition = 'center') {
  const scrollRoot = document.querySelector<HTMLElement>('[data-notes-sidebar-scroll-root="true"]');
  if (!scrollRoot) {
    return;
  }

  const escapedPath = escapeAttributeValue(path);
  const target = scrollRoot.querySelector<HTMLElement>(`[data-file-tree-path="${escapedPath}"]`);
  if (!target) {
    return;
  }

  target.scrollIntoView({
    block,
    behavior: 'smooth',
  });
}

export function scheduleSidebarItemIntoView(
  path: string,
  frameCount: number = 1,
  block: ScrollLogicalPosition = 'center'
) {
  const run = (remainingFrames: number) => {
    if (remainingFrames <= 0) {
      scrollSidebarItemIntoView(path, block);
      return;
    }

    window.requestAnimationFrame(() => run(remainingFrames - 1));
  };

  run(frameCount);
}
