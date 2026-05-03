import { useSyncExternalStore } from 'react';
import { SIDEBAR_SCROLL_ROOT_SELECTOR } from '../../Sidebar/context-menu/shared';
import { useNotesStore } from '@/stores/useNotesStore';
import {
  createStarredEntry,
  getStarredEntryKey,
  getVaultStarredPaths,
  saveStarredRegistry,
} from '@/stores/notes/starred';
import type { StarredKind } from '@/stores/notes/types';
import { resolveInternalMoveDropTargetPath, resolveStarredDropTargetFromElements } from './dropTargetDom';
import { NOTES_DRAG_RETURN_ANIMATION } from '../../common/NotesDragOverlay';

type FileTreePointerDragSourceKind = 'note' | 'folder';
type FileTreePointerDropTargetKind = 'folder' | 'starred' | null;

interface FileTreePointerDragSnapshot {
  activeSourcePath: string | null;
  dropTargetPath: string | null;
  dropTargetKind: FileTreePointerDropTargetKind;
}

interface FileTreePointerDragSession {
  sourcePath: string;
  sourceKind: FileTreePointerDragSourceKind;
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
  pendingStarredDrop: boolean;
  previousBodyCursor: string;
  previousBodyUserSelect: string;
  suppressClickTimeout: number | null;
}

const DRAG_THRESHOLD_PX = 4;

let snapshot: FileTreePointerDragSnapshot = {
  activeSourcePath: null,
  dropTargetPath: null,
  dropTargetKind: null,
};

let activeSession: FileTreePointerDragSession | null = null;
let pendingClickSuppressionCleanup: (() => void) | null = null;

const listeners = new Set<() => void>();

function emitSnapshot() {
  listeners.forEach((listener) => listener());
}

function setSnapshot(nextSnapshot: FileTreePointerDragSnapshot) {
  if (
    snapshot.activeSourcePath === nextSnapshot.activeSourcePath &&
    snapshot.dropTargetPath === nextSnapshot.dropTargetPath &&
    snapshot.dropTargetKind === nextSnapshot.dropTargetKind
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
  previewElement.style.borderRadius = '0.75rem';
  previewElement.style.filter = 'saturate(1.02)';
  previewElement.style.willChange = 'transform';
  previewElement.dataset.fileTreeDragOriginalPaddingRight = previewElement.style.paddingRight;
  document.body.appendChild(previewElement);
  return { previewElement, rect };
}

function createPreviewStarBadge() {
  const badge = document.createElement('span');
  badge.dataset.fileTreeDragStarBadge = 'true';
  badge.setAttribute('aria-hidden', 'true');
  badge.style.position = 'absolute';
  badge.style.right = '8px';
  badge.style.top = '50%';
  badge.style.transform = 'translateY(-50%)';
  badge.style.display = 'inline-flex';
  badge.style.alignItems = 'center';
  badge.style.justifyContent = 'center';
  badge.style.width = '18px';
  badge.style.height = '18px';
  badge.style.color = '#f59e0b';
  badge.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M9.1 2.5a1 1 0 0 1 1.8 0l1.6 3.3 3.6.5a1 1 0 0 1 .6 1.7l-2.6 2.5.6 3.6a1 1 0 0 1-1.5 1.1L10 13.5l-3.2 1.7a1 1 0 0 1-1.5-1.1l.6-3.6L3.3 8a1 1 0 0 1 .6-1.7l3.6-.5 1.6-3.3Z"/></svg>';
  return badge;
}

function setPreviewStarred(starred: boolean) {
  const previewElement = activeSession?.previewElement;
  if (!previewElement) return;

  const existing = previewElement.querySelector('[data-file-tree-drag-star-badge="true"]');
  if (!starred) {
    existing?.remove();
    previewElement.style.paddingRight = previewElement.dataset.fileTreeDragOriginalPaddingRight ?? '';
    return;
  }

  if (existing) return;
  previewElement.style.paddingRight = '30px';
  previewElement.appendChild(createPreviewStarBadge());
}

function updatePreviewPosition() {
  if (!activeSession?.previewElement) {
    return;
  }

  activeSession.previewElement.style.transform = `translate3d(${Math.round(activeSession.lastClientX - activeSession.previewOffsetX)}px, ${Math.round(activeSession.lastClientY - activeSession.previewOffsetY)}px, 0)`;
}

function animatePreviewBackToSource(
  previewElement: HTMLElement | null,
  sourceElement: HTMLElement | null,
) {
  if (!previewElement?.isConnected || !sourceElement?.isConnected) {
    previewElement?.remove();
    return;
  }

  const sourceRect = sourceElement.getBoundingClientRect();
  const currentTransform = previewElement.style.transform;
  const targetTransform = `translate3d(${Math.round(sourceRect.left)}px, ${Math.round(sourceRect.top)}px, 0)`;
  const animate = previewElement.animate?.bind(previewElement);

  if (!animate) {
    previewElement.remove();
    return;
  }

  previewElement.style.transform = targetTransform;
  previewElement.style.pointerEvents = 'none';

  const animation = animate(
    [
      { transform: currentTransform, opacity: previewElement.style.opacity || '0.92' },
      { transform: targetTransform, opacity: previewElement.style.opacity || '0.92' },
    ],
    {
      duration: NOTES_DRAG_RETURN_ANIMATION.duration,
      easing: NOTES_DRAG_RETURN_ANIMATION.easing,
      fill: 'forwards',
    },
  );

  void animation.finished.then(
    () => previewElement.remove(),
    () => previewElement.remove(),
  );
}

function getScrollRoot() {
  return document.querySelector<HTMLElement>(SIDEBAR_SCROLL_ROOT_SELECTOR);
}

function updateDropTarget() {
  if (!activeSession?.activated) {
    return;
  }

  const elements = document.elementsFromPoint(activeSession.lastClientX, activeSession.lastClientY);
  const isStarredDropTarget = resolveStarredDropTargetFromElements(elements);

  if (isStarredDropTarget) {
    activeSession.pendingStarredDrop = true;
    setPreviewStarred(true);
    setSnapshot({
      activeSourcePath: activeSession.sourcePath,
      dropTargetPath: null,
      dropTargetKind: 'starred',
    });
    return;
  }

  activeSession.pendingStarredDrop = false;
  setPreviewStarred(false);
  const folderDropTargetPath = resolveInternalMoveDropTargetPath(
    activeSession.lastClientX,
    activeSession.lastClientY,
    activeSession.sourcePath,
  );
  setSnapshot({
    activeSourcePath: activeSession.sourcePath,
    dropTargetPath: folderDropTargetPath,
    dropTargetKind: folderDropTargetPath == null ? null : 'folder',
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
  pendingClickSuppressionCleanup?.();
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return;
  }

  let timeoutId: number | null = null;
  const handleClick = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    cleanup();
  };

  const cleanup = () => {
    if (typeof document !== 'undefined') {
      document.removeEventListener('click', handleClick, true);
    }
    if (timeoutId != null) {
      globalThis.clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (activeSession?.suppressClickTimeout != null) {
      globalThis.clearTimeout(activeSession.suppressClickTimeout);
      activeSession.suppressClickTimeout = null;
    }
    if (pendingClickSuppressionCleanup === cleanup) {
      pendingClickSuppressionCleanup = null;
    }
  };

  document.addEventListener('click', handleClick, true);
  timeoutId = window.setTimeout(cleanup, 250);
  pendingClickSuppressionCleanup = cleanup;

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
    updateDropTarget();

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

function ensureStarredPath(kind: StarredKind, relativePath: string) {
  const state = useNotesStore.getState();
  const { notesPath, starredEntries } = state;
  if (!notesPath) return;

  const key = getStarredEntryKey({ kind, vaultPath: notesPath, relativePath });
  if (starredEntries.some((entry) => getStarredEntryKey(entry) === key)) {
    return;
  }

  const updatedEntries = [...starredEntries, createStarredEntry(kind, notesPath, relativePath)];
  const starredPaths = getVaultStarredPaths(updatedEntries, notesPath);
  useNotesStore.setState({
    starredEntries: updatedEntries,
    starredNotes: starredPaths.notes,
    starredFolders: starredPaths.folders,
  });
  saveStarredRegistry(updatedEntries);
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

  if (activeSession?.previewElement) {
    activeSession.previewElement.remove();
  }

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
    dropTargetKind: null,
  });
}

function finishPointerDrag(shouldCommit: boolean) {
  if (!activeSession) {
    return;
  }

  const sourcePath = activeSession.sourcePath;
  const sourceKind = activeSession.sourceKind;
  const sourceElement = activeSession.sourceElement;
  const previewElement = activeSession.previewElement;
  const hasVisibleStarBadge = Boolean(
    previewElement?.querySelector('[data-file-tree-drag-star-badge="true"]'),
  );
  const shouldStar = shouldCommit && activeSession.activated && (
    activeSession.pendingStarredDrop || hasVisibleStarBadge || snapshot.dropTargetKind === 'starred'
  );
  const dropTargetPath = snapshot.dropTargetPath;
  const dropTargetKind = snapshot.dropTargetKind;
  const shouldMove = !shouldStar && shouldCommit && activeSession.activated && dropTargetKind === 'folder' && dropTargetPath != null;
  const shouldSuppressClick = shouldCommit && activeSession.activated;

  activeSession.previewElement = null;

  teardownPointerDrag();
  animatePreviewBackToSource(previewElement, sourceElement);

  if (shouldSuppressClick) {
    suppressNextClick();
  }

  if (shouldStar) {
    ensureStarredPath(sourceKind === 'folder' ? 'folder' : 'note', sourcePath);
  }

  if (shouldMove && dropTargetPath !== null) {
    void useNotesStore.getState().moveItem(sourcePath, dropTargetPath);
  }
}

export function startFileTreePointerDrag(
  sourcePath: string,
  sourceKind: FileTreePointerDragSourceKind,
  sourceElement: HTMLElement,
  event: PointerEvent,
) {
  if (activeSession) {
    finishPointerDrag(false);
  }

  activeSession = {
    sourcePath,
    sourceKind,
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
    pendingStarredDrop: false,
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

export function requestFileTreePointerDragDropTargetUpdate() {
  updateDropTarget();
}

export function useFileTreePointerDragState<T>(selector: (snapshot: FileTreePointerDragSnapshot) => T) {
  return useSyncExternalStore(
    subscribe,
    () => selector(getSnapshot()),
    () => selector(getSnapshot()),
  );
}
