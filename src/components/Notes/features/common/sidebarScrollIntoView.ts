function escapeAttributeValue(value: string) {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }

  return value.replace(/["\\]/g, '\\$&');
}

export function scrollSidebarItemIntoView(path: string) {
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
    block: 'center',
    behavior: 'smooth',
  });
}
