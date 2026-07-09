import { useEffect } from 'react';
import { logNotesSplitDiagnostic } from '@/lib/diagnostics/notesSplitDiagnostics';

function getLeafDetails(element: Element | null): {
  leafId: string;
  pane: string;
  path: string;
} {
  const leaf = element?.closest<HTMLElement>('[data-notes-split-leaf-id][data-notes-split-leaf-path]');
  return {
    leafId: leaf?.dataset.notesSplitLeafId ?? '',
    pane: leaf?.dataset.notesSplitPane ?? '',
    path: leaf?.dataset.notesSplitLeafPath ?? '',
  };
}

function getImageDetails(image: HTMLImageElement): Record<string, unknown> {
  return {
    complete: image.complete,
    currentSrc: image.currentSrc,
    naturalHeight: image.naturalHeight,
    naturalWidth: image.naturalWidth,
    src: image.getAttribute('src') ?? '',
  };
}

function collectCoverSnapshot(): Array<Record<string, unknown>> {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-notes-split-leaf-id][data-notes-split-leaf-path]'))
    .map((leaf) => ({
      coverRegions: Array.from(leaf.querySelectorAll<HTMLElement>('[data-note-cover-region="true"]'))
        .map((cover) => ({
          animateIn: cover.classList.contains('animate-in'),
          className: cover.className,
          images: Array.from(cover.querySelectorAll<HTMLImageElement>('img')).map(getImageDetails),
        })),
      leafId: leaf.dataset.notesSplitLeafId ?? '',
      pane: leaf.dataset.notesSplitPane ?? '',
      path: leaf.dataset.notesSplitLeafPath ?? '',
    }));
}

function includesCoverRegion(node: Node): boolean {
  if (!(node instanceof Element)) {
    return false;
  }

  const cover = node.matches('[data-note-cover-region="true"]')
    ? node
    : node.querySelector('[data-note-cover-region="true"]');
  return cover instanceof HTMLElement;
}

export function NotesSplitDiagnosticsButton() {
  useEffect(() => {
    if (typeof MutationObserver === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
      logNotesSplitDiagnostic('split-diagnostics-observer-unavailable');
      return;
    }

    const root = document.querySelector<HTMLElement>('[data-notes-split-drop-root="true"]');
    if (!root) {
      return;
    }

    let snapshotFrame: number | null = null;
    let lastSnapshotJson = '';
    const scheduleSnapshot = (reason: string) => {
      if (snapshotFrame !== null) {
        return;
      }
      snapshotFrame = window.requestAnimationFrame(() => {
        snapshotFrame = null;
        const snapshot = collectCoverSnapshot();
        const snapshotJson = JSON.stringify(snapshot);
        if (snapshotJson === lastSnapshotJson) {
          return;
        }
        lastSnapshotJson = snapshotJson;
        logNotesSplitDiagnostic('split-dom-snapshot', {
          reason,
          snapshot,
        });
      });
    };

    const observer = new MutationObserver((mutations) => {
      let didLogCoverMutation = false;
      for (const mutation of mutations) {
        if (mutation.type === 'attributes') {
          const target = mutation.target;
          if (
            target instanceof HTMLImageElement &&
            mutation.attributeName === 'src' &&
            target.closest('[data-note-cover-region="true"]')
          ) {
            didLogCoverMutation = true;
          }
          if (target instanceof HTMLElement && mutation.attributeName === 'class' && target.matches('[data-note-cover-region="true"]')) {
            didLogCoverMutation = true;
          }
        }

        for (const node of mutation.addedNodes) {
          if (includesCoverRegion(node)) {
            didLogCoverMutation = true;
          }
        }
        for (const node of mutation.removedNodes) {
          if (includesCoverRegion(node)) {
            didLogCoverMutation = true;
          }
        }
      }
      if (didLogCoverMutation) {
        scheduleSnapshot('cover-mutation');
      }
    });

    const handleImageError = (event: Event) => {
      if (!(event.target instanceof HTMLImageElement)) {
        return;
      }
      if (!event.target.closest('[data-note-cover-region="true"]')) {
        return;
      }
      logNotesSplitDiagnostic('cover-img-error', {
        image: getImageDetails(event.target),
        leaf: getLeafDetails(event.target),
      });
    };
    observer.observe(root, {
      attributeFilter: ['class', 'src'],
      attributes: true,
      childList: true,
      subtree: true,
    });
    root.addEventListener('error', handleImageError, true);

    return () => {
      if (snapshotFrame !== null) {
        window.cancelAnimationFrame(snapshotFrame);
      }
      observer.disconnect();
      root.removeEventListener('error', handleImageError, true);
    };
  }, []);

  return null;
}
