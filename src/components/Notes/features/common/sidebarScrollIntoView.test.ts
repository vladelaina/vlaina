import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  SIDEBAR_SCROLL_TO_PATH_EVENT,
  consumeSuppressedCurrentNoteSidebarReveal,
  scrollSidebarItemIntoView,
  suppressNextCurrentNoteSidebarReveal,
  type SidebarScrollToPathDetail,
} from './sidebarScrollIntoView';

describe('scrollSidebarItemIntoView', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('prefers the main file tree when a starred row has the same path', () => {
    const starredScrollIntoView = vi.fn();
    const treeScrollIntoView = vi.fn();
    const arrayFromSpy = vi.spyOn(Array, 'from').mockImplementation(() => {
      throw new Error('Sidebar reveal should not materialize selector results');
    });

    try {
      document.body.innerHTML = `
        <div data-notes-sidebar-scroll-root="true">
          <div data-file-tree-path="docs/alpha.md" data-testid="starred"></div>
          <div data-file-tree-primary="true">
            <div data-file-tree-path="docs/alpha.md" data-testid="tree"></div>
          </div>
        </div>
      `;

      const starred = document.querySelector<HTMLElement>('[data-testid="starred"]');
      const tree = document.querySelector<HTMLElement>('[data-testid="tree"]');
      starred!.scrollIntoView = starredScrollIntoView;
      tree!.scrollIntoView = treeScrollIntoView;

      expect(scrollSidebarItemIntoView('docs/alpha.md')).toBe(true);
      expect(treeScrollIntoView).toHaveBeenCalledWith({
        block: 'center',
        behavior: 'auto',
      });
      expect(starredScrollIntoView).not.toHaveBeenCalled();
      expect(arrayFromSpy).not.toHaveBeenCalled();
    } finally {
      arrayFromSpy.mockRestore();
    }
  });

  it('does not fall back to starred rows while the main tree is mounted', () => {
    const starredScrollIntoView = vi.fn();
    const handled = vi.fn((event: Event) => {
      const detail = (event as CustomEvent<SidebarScrollToPathDetail>).detail;
      if (detail.path === 'docs/alpha.md') {
        event.preventDefault();
      }
    });

    document.body.innerHTML = `
      <div data-notes-sidebar-scroll-root="true">
        <div data-file-tree-path="docs/alpha.md" data-testid="starred"></div>
        <div data-file-tree-primary="true"></div>
      </div>
    `;

    const scrollRoot = document.querySelector<HTMLElement>('[data-notes-sidebar-scroll-root="true"]');
    const starred = document.querySelector<HTMLElement>('[data-testid="starred"]');
    starred!.scrollIntoView = starredScrollIntoView;
    scrollRoot!.addEventListener(SIDEBAR_SCROLL_TO_PATH_EVENT, handled);

    expect(scrollSidebarItemIntoView('docs/alpha.md')).toBe(true);
    expect(starredScrollIntoView).not.toHaveBeenCalled();
    expect(handled).toHaveBeenCalledTimes(1);
  });

  it('does not scroll a starred duplicate when the main tree row is not mounted yet', () => {
    const starredScrollIntoView = vi.fn();

    document.body.innerHTML = `
      <div data-notes-sidebar-scroll-root="true">
        <div data-file-tree-starred-section="true">
          <div data-file-tree-path="docs/alpha.md" data-testid="starred"></div>
        </div>
      </div>
    `;

    const starred = document.querySelector<HTMLElement>('[data-testid="starred"]');
    starred!.scrollIntoView = starredScrollIntoView;

    expect(scrollSidebarItemIntoView('docs/alpha.md')).toBe(false);
    expect(starredScrollIntoView).not.toHaveBeenCalled();
  });

  it('consumes one matching current note reveal suppression', () => {
    suppressNextCurrentNoteSidebarReveal('docs/alpha.md');

    expect(consumeSuppressedCurrentNoteSidebarReveal('docs/alpha.md')).toBe(true);
    expect(consumeSuppressedCurrentNoteSidebarReveal('docs/alpha.md')).toBe(false);
  });

  it('keeps current note reveal suppression on a nonmatching path until the target opens', () => {
    suppressNextCurrentNoteSidebarReveal('docs/alpha.md');

    expect(consumeSuppressedCurrentNoteSidebarReveal('docs/beta.md')).toBe(false);
    expect(consumeSuppressedCurrentNoteSidebarReveal('docs/alpha.md')).toBe(true);
  });

  it('restores the sidebar scroll position when consuming a reveal suppression', () => {
    const scrollTo = vi.fn();
    document.body.innerHTML = '<div data-notes-sidebar-scroll-root="true"></div>';
    const scrollRoot = document.querySelector<HTMLElement>('[data-notes-sidebar-scroll-root="true"]');
    Object.defineProperty(scrollRoot, 'scrollTop', { value: 320, configurable: true });
    scrollRoot!.scrollTo = scrollTo;

    suppressNextCurrentNoteSidebarReveal('docs/alpha.md');
    expect(consumeSuppressedCurrentNoteSidebarReveal('docs/alpha.md', scrollRoot)).toBe(true);

    expect(scrollTo).toHaveBeenCalledWith({ top: 320, behavior: 'auto' });
  });
});
