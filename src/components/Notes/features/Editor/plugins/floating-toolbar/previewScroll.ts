import { NOTE_SCROLL_ROOT_SELECTOR } from './previewStyleConstants';
import { previewStyleState, type PreviewScrollSnapshot } from './previewStyleState';

export function capturePreviewScrollSnapshot(viewDom: HTMLElement): PreviewScrollSnapshot | null {
  const scrollRoot = viewDom.closest(NOTE_SCROLL_ROOT_SELECTOR);
  if (!(scrollRoot instanceof HTMLElement)) {
    return null;
  }

  const releaseGuard = retainPreviewScrollGuard(scrollRoot);
  return {
    element: scrollRoot,
    releaseGuard,
    scrollLeft: scrollRoot.scrollLeft,
    scrollTop: scrollRoot.scrollTop,
  };
}

function retainPreviewScrollGuard(element: HTMLElement): () => void {
  let guard = previewStyleState.previewScrollGuards.get(element);
  if (!guard) {
    guard = {
      count: 0,
      originalOverflowAnchor: element.style.getPropertyValue('overflow-anchor'),
      originalOverflowAnchorPriority: element.style.getPropertyPriority('overflow-anchor'),
    };
    previewStyleState.previewScrollGuards.set(element, guard);
    element.style.setProperty('overflow-anchor', 'none', 'important');
  }

  guard.count += 1;

  let released = false;
  return () => {
    if (released) {
      return;
    }
    released = true;

    const currentGuard = previewStyleState.previewScrollGuards.get(element);
    if (!currentGuard) {
      return;
    }

    currentGuard.count -= 1;
    if (currentGuard.count > 0) {
      return;
    }

    previewStyleState.previewScrollGuards.delete(element);
    if (currentGuard.originalOverflowAnchor) {
      element.style.setProperty(
        'overflow-anchor',
        currentGuard.originalOverflowAnchor,
        currentGuard.originalOverflowAnchorPriority
      );
    } else {
      element.style.removeProperty('overflow-anchor');
    }
  };
}

export function restorePreviewScrollSnapshot(snapshot: PreviewScrollSnapshot | null): void {
  if (!snapshot) {
    return;
  }

  let lastRestoredScrollLeft: number | null = null;
  let lastRestoredScrollTop: number | null = null;
  let cancelledByExternalScroll = false;

  const restore = () => {
    if (!snapshot.element.isConnected || cancelledByExternalScroll) {
      return;
    }
    if (
      lastRestoredScrollLeft !== null &&
      lastRestoredScrollTop !== null &&
      (
        Math.abs(snapshot.element.scrollLeft - lastRestoredScrollLeft) > 1 ||
        Math.abs(snapshot.element.scrollTop - lastRestoredScrollTop) > 1
      )
    ) {
      // A later user scroll should win over the preview guard's delayed restore callbacks.
      cancelledByExternalScroll = true;
      return;
    }

    snapshot.element.scrollLeft = snapshot.scrollLeft;
    snapshot.element.scrollTop = snapshot.scrollTop;
    lastRestoredScrollLeft = snapshot.element.scrollLeft;
    lastRestoredScrollTop = snapshot.element.scrollTop;
  };
  const ownerWindow = snapshot.element.ownerDocument.defaultView;
  const releaseGuard = () => {
    restore();
    snapshot.releaseGuard();
  };

  restore();
  queueMicrotask(restore);
  ownerWindow?.requestAnimationFrame(() => {
    restore();
    ownerWindow.requestAnimationFrame(restore);
  });
  ownerWindow?.setTimeout(restore, 0);
  if (ownerWindow) {
    ownerWindow.setTimeout(releaseGuard, 50);
  } else {
    snapshot.releaseGuard();
  }
}
