import type { EditorView } from '@milkdown/kit/prose/view';
import { bindAiDropdownInteractions } from './ai-dropdown/actions';
import { createAiDropdownMarkup } from './ai-dropdown/markup';

export interface AiDropdownController {
  render: (container: HTMLElement, view: EditorView, onClose: () => void) => void;
  cleanup: () => void;
  destroy: () => void;
}

export function createAiDropdownController(): AiDropdownController {
  const cleanupCallbacks: Array<() => void> = [];
  let frameId = 0;
  let scrollStateFrameId = 0;

  const syncScrollableState = (dropdown: HTMLElement) => {
    dropdown.querySelectorAll<HTMLElement>('.ai-dropdown-root, .ai-dropdown-children').forEach((element) => {
      const overflowThreshold = 4;
      const isScrollable = element.scrollHeight - element.clientHeight > overflowThreshold;
      element.dataset.scrollable = isScrollable ? 'true' : 'false';
      element.classList.toggle('neko-scrollbar', isScrollable);
    });
  };

  const scheduleScrollableStateSync = (dropdown: HTMLElement) => {
    if (scrollStateFrameId) {
      cancelAnimationFrame(scrollStateFrameId);
    }

    scrollStateFrameId = requestAnimationFrame(() => {
      scrollStateFrameId = requestAnimationFrame(() => {
        scrollStateFrameId = 0;
        syncScrollableState(dropdown);
      });
    });
  };

  const syncScrollableHeight = (dropdown: HTMLElement) => {
    if (!dropdown.isConnected) {
      return;
    }

    const rect = dropdown.getBoundingClientRect();
    const viewportPadding = 16;
    const root = dropdown.querySelector<HTMLElement>('.ai-dropdown-root');
    const activeChildren = dropdown.querySelector<HTMLElement>('.ai-dropdown-panel.active .ai-dropdown-children');
    const naturalHeight = Math.max(root?.scrollHeight ?? 0, activeChildren?.scrollHeight ?? 0);
    const availableHeight = Math.max(0, window.innerHeight - rect.top - viewportPadding);
    const nextHeight = Math.min(naturalHeight, availableHeight);

    dropdown.style.setProperty('--ai-dropdown-panel-max-height', `${nextHeight}px`);
    scheduleScrollableStateSync(dropdown);
  };

  const scheduleScrollableHeightSync = (dropdown: HTMLElement) => {
    if (frameId) {
      cancelAnimationFrame(frameId);
    }

    frameId = requestAnimationFrame(() => {
      frameId = 0;
      syncScrollableHeight(dropdown);
    });
  };

  const bindWheelScroll = (element: HTMLElement) => {
    const handleWheel = (event: WheelEvent) => {
      if (element.scrollHeight <= element.clientHeight) {
        return;
      }

      const nextScrollTop = element.scrollTop + event.deltaY;
      const maxScrollTop = element.scrollHeight - element.clientHeight;
      const clampedScrollTop = Math.max(0, Math.min(nextScrollTop, maxScrollTop));
      if (clampedScrollTop === element.scrollTop) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      element.scrollTop = clampedScrollTop;
    };

    element.addEventListener('wheel', handleWheel, { passive: false });
    cleanupCallbacks.push(() => {
      element.removeEventListener('wheel', handleWheel);
    });
  };

  const cleanup = () => {
    if (frameId) {
      cancelAnimationFrame(frameId);
      frameId = 0;
    }

    if (scrollStateFrameId) {
      cancelAnimationFrame(scrollStateFrameId);
      scrollStateFrameId = 0;
    }

    while (cleanupCallbacks.length > 0) {
      cleanupCallbacks.pop()?.();
    }
  };

  const render = (container: HTMLElement, view: EditorView, _onClose: () => void) => {
    cleanup();

    const dropdown = document.createElement('div');
    dropdown.className = 'toolbar-submenu ai-dropdown ai-dropdown-nested';
    dropdown.innerHTML = createAiDropdownMarkup();

    container.appendChild(dropdown);
    syncScrollableHeight(dropdown);
    dropdown.querySelectorAll<HTMLElement>('.ai-dropdown-root, .ai-dropdown-children').forEach(bindWheelScroll);
    bindAiDropdownInteractions(dropdown, view);

    const handleViewportChange = () => {
      scheduleScrollableHeightSync(dropdown);
    };
    const handleCategoryChange = () => {
      scheduleScrollableHeightSync(dropdown);
    };

    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);
    dropdown.addEventListener('ai-dropdown:category-change', handleCategoryChange);
    cleanupCallbacks.push(() => {
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
      dropdown.removeEventListener('ai-dropdown:category-change', handleCategoryChange);
    });
  };

  return {
    render,
    cleanup,
    destroy() {
      cleanup();
    },
  };
}
