import { useSyncExternalStore } from 'react';
import { SIDEBAR_SCROLL_ROOT_SELECTOR } from '../../Sidebar/context-menu/shared';
import { useNotesStore } from '@/stores/useNotesStore';
import { resolveInternalMoveDropTargetPath } from './dropTargetDom';

interface FileTreePointerDragSnapshot {
  activeSourcePath: string | null;
  dropTargetPath: string | null;
}

interface FileTreePointerDragSession {
  sourcePath: string;
  sourceElement: HTMLElement;
  startX: number;
  startY: number;
  lastClientX: number;
  lastClientY: number;
  activated: boolean;
  autoScrollFrame: number | null;
  scrollRoot: HTMLElement | null;
  previewElement: HTMLElement | null;
  previewOffsetX: number;
  previewOffsetY: number;
  previousBodyCursor: string;
  previousBodyUserSelect: string;
  suppressClickTimeout: number | null;
}

const DRAG_THRESHOLD_PX = 4;

let snapshot: FileTreePointerDragSnapshot = {
  activeSourcePath: null,
  dropTargetPath: null,
};

let activeSession: FileTreePointerDragSession | null = null;

const listeners = new Set<() => void>();

function emitSnapshot() {
  listeners.forEach((listener) => listener());
}

function setSnapshot(nextSnapshot: FileTreePointerDragSnapshot) {
  if (
    snapshot.activeSourcePath === nextSnapshot.activeSourcePath &&
    snapshot.dropTargetPath === nextSnapshot.dropTargetPath
  ) {
    return;
  }

  snapshot = nextSnapshot;
  emitSnapshot();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return snapshot;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function createPreviewElement(sourceElement: HTMLElement) {
  const rect = sourceElement.getBoundingClientRect();
  const previewElement = sourceElement.cloneNode(true) as HTMLElement;
  previewElement.style.position = 'fixed';
  previewElement.style.left = '0';
  previewElement.style.top = '0';
  previewElement.style.width = `${Math.round(rect.width)}px`;
  previewElement.style.pointerEvents = 'none';
  previewElement.style.zIndex = '9999';
  previewElement.style.margin = '0';
  previewElement.style.opacity = '0.92';
  previewElement.style.transform = 'translate3d(-9999px, -9999px, 0)';
  previewElement.style.boxShadow = '0 14px 32px rgba(15, 23, 42, 0.18)';
  previewElement.style.filter = 'saturate(1.02)';
  previewElement.style.willChange = 'transform';
  previewElement.classList.add('rounded-md');
  document.body.appendChild(previewElement);
  return { previewElement, rect };
}

function updatePreviewPosition() {
  if (!activeSession?.previewElement) {
    return;
  }

  activeSession.previewElement.style.transform = `translate3d(${Math.round(activeSession.lastClientX - activeSession.previewOffsetX)}px, ${Math.round(activeSession.lastClientY - activeSession.previewOffsetY)}px, 0)`;
}

function getScrollRoot() {
  return document.querySelector<HTMLElement>(SIDEBAR_SCROLL_ROOT_SELECTOR);
}

function updateDropTarget() {
  if (!activeSession?.activated) {
    return;
  }

  setSnapshot({
    activeSourcePath: activeSession.sourcePath,
    dropTargetPath: resolveInternalMoveDropTargetPath(
      activeSession.lastClientX,
      activeSession.lastClientY,
      activeSession.sourcePath,
    ),
  });
}

function stopAutoScroll() {
  if (activeSession?.autoScrollFrame == null) {
    return;
  }

  window.cancelAnimationFrame(activeSession.autoScrollFrame);
  activeSession.autoScrollFrame = null;
}

function stepAutoScroll() {
  if (!activeSession?.activated) {
    return;
  }

  const scrollRoot = activeSession.scrollRoot;
  activeSession.autoScrollFrame = null;

  if (!scrollRoot) {
    return;
  }

  const rect = scrollRoot.getBoundingClientRect();
  const maxScrollTop = Math.max(scrollRoot.scrollHeight - scrollRoot.clientHeight, 0);
  if (maxScrollTop <= 0) {
    return;
  }

  const edgeSize = Math.min(96, Math.max(40, rect.height * 0.24));
  let delta = 0;

  if (activeSession.lastClientY < rect.top + edgeSize) {
    delta = -((rect.top + edgeSize - activeSession.lastClientY) / edgeSize) * 28;
  } else if (activeSession.lastClientY > rect.bottom - edgeSize) {
    delta = ((activeSession.lastClientY - (rect.bottom - edgeSize)) / edgeSize) * 28;
  }

  if (delta === 0) {
    return;
  }

  const nextScrollTop = clamp(scrollRoot.scrollTop + delta, 0, maxScrollTop);
  if (nextScrollTop === scrollRoot.scrollTop) {
    return;
  }

  scrollRoot.scrollTop = nextScrollTop;
  updateDropTarget();
  activeSession.autoScrollFrame = window.requestAnimationFrame(stepAutoScroll);
}

function queueAutoScroll() {
  if (!activeSession?.activated || activeSession.autoScrollFrame != null) {
    return;
  }

  activeSession.autoScrollFrame = window.requestAnimationFrame(stepAutoScroll);
}

function suppressNextClick() {
  const handleClick = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    document.removeEventListener('click', handleClick, true);
    if (activeSession?.suppressClickTimeout != null) {
      window.clearTimeout(activeSession.suppressClickTimeout);
      activeSession.suppressClickTimeout = null;
    }
  };

  document.addEventListener('click', handleClick, true);
  const timeoutId = window.setTimeout(() => {
    document.removeEventListener('click', handleClick, true);
  }, 250);

  if (activeSession) {
    activeSession.suppressClickTimeout = timeoutId;
  }
}

function handlePointerMove(event: PointerEvent) {
  if (!activeSession) {
    return;
  }

  if ((event.buttons & 1) === 0) {
    finishPointerDrag(false);
    return;
  }

  activeSession.lastClientX = event.clientX;
  activeSession.lastClientY = event.clientY;

  if (!activeSession.activated) {
    const distance = Math.hypot(
      event.clientX - activeSession.startX,
      event.clientY - activeSession.startY,
    );
    if (distance < DRAG_THRESHOLD_PX) {
      return;
    }

    activeSession.activated = true;
    activeSession.scrollRoot = getScrollRoot();
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
    const { previewElement, rect } = createPreviewElement(activeSession.sourceElement);
    activeSession.previewElement = previewElement;
    activeSession.previewOffsetX = Math.min(Math.max(activeSession.startX - rect.left, 16), rect.width - 16);
    activeSession.previewOffsetY = Math.min(Math.max(activeSession.startY - rect.top, 12), rect.height - 12);
    updatePreviewPosition();
    setSnapshot({
      activeSourcePath: activeSession.sourcePath,
      dropTargetPath: resolveInternalMoveDropTargetPath(
        activeSession.lastClientX,
        activeSession.lastClientY,
        activeSession.sourcePath,
      ),
    });

    activeSession.scrollRoot?.addEventListener('scroll', handleScrollRootScroll, true);
  } else {
    updateDropTarget();
  }

  event.preventDefault();
  updatePreviewPosition();
  queueAutoScroll();
}

function handlePointerUp(event: PointerEvent) {
  if (!activeSession) {
    return;
  }

  if (activeSession.activated) {
    event.preventDefault();
    finishPointerDrag(true);
    return;
  }

  finishPointerDrag(false);
}

function handlePointerCancel() {
  finishPointerDrag(false);
}

function handleKeyDown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !activeSession) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  finishPointerDrag(false);
}

function handleScrollRootScroll() {
  updateDropTarget();
  queueAutoScroll();
}

function teardownPointerDrag() {
  stopAutoScroll();
  document.removeEventListener('pointermove', handlePointerMove, true);
  document.removeEventListener('pointerup', handlePointerUp, true);
  document.removeEventListener('pointercancel', handlePointerCancel, true);
  document.removeEventListener('keydown', handleKeyDown, true);
  window.removeEventListener('blur', handlePointerCancel, true);

  if (activeSession?.scrollRoot) {
    activeSession.scrollRoot.removeEventListener('scroll', handleScrollRootScroll, true);
  }

  activeSession?.previewElement?.remove();

  if (activeSession?.suppressClickTimeout != null) {
    window.clearTimeout(activeSession.suppressClickTimeout);
  }

  if (activeSession) {
    document.body.style.cursor = activeSession.previousBodyCursor;
    document.body.style.userSelect = activeSession.previousBodyUserSelect;
  }

  activeSession = null;
  setSnapshot({
    activeSourcePath: null,
    dropTargetPath: null,
  });
}

function finishPointerDrag(shouldCommit: boolean) {
  if (!activeSession) {
    return;
  }

  const sourcePath = activeSession.sourcePath;
  const dropTargetPath = snapshot.dropTargetPath;
  const shouldMove = shouldCommit && activeSession.activated && dropTargetPath != null;
  const shouldSuppressClick = shouldCommit && activeSession.activated;

  teardownPointerDrag();

  if (shouldSuppressClick) {
    suppressNextClick();
  }

  if (shouldMove && dropTargetPath !== null) {
    void useNotesStore.getState().moveItem(sourcePath, dropTargetPath);
  }
}

export function startFileTreePointerDrag(sourcePath: string, sourceElement: HTMLElement, event: PointerEvent) {
  if (activeSession) {
    finishPointerDrag(false);
  }

  activeSession = {
    sourcePath,
    sourceElement,
    startX: event.clientX,
    startY: event.clientY,
    lastClientX: event.clientX,
    lastClientY: event.clientY,
    activated: false,
    autoScrollFrame: null,
    scrollRoot: null,
    previewElement: null,
    previewOffsetX: 20,
    previewOffsetY: 14,
    previousBodyCursor: document.body.style.cursor,
    previousBodyUserSelect: document.body.style.userSelect,
    suppressClickTimeout: null,
  };

  document.addEventListener('pointermove', handlePointerMove, true);
  document.addEventListener('pointerup', handlePointerUp, true);
  document.addEventListener('pointercancel', handlePointerCancel, true);
  document.addEventListener('keydown', handleKeyDown, true);
  window.addEventListener('blur', handlePointerCancel, true);
}

export function useFileTreePointerDragState<T>(selector: (snapshot: FileTreePointerDragSnapshot) => T) {
  return useSyncExternalStore(
    subscribe,
    () => selector(getSnapshot()),
    () => selector(getSnapshot()),
  );
}
