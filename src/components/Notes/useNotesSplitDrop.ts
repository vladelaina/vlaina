import { useCallback, useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { openStoredNotePath } from '@/stores/notes/openNotePath';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import { subscribeNotesTabSplitDrag, type NotesSplitDragSource } from './features/Split/notesSplitDragEvents';
import {
  createInitialNotesSplitPaneTree,
  pruneNotesSplitPaneTree,
  resolveNotesSplitDropDirection,
  splitNotesPaneTree,
  type NotesSplitPaneTree,
  type NotesSplitPreviewLeaf,
} from './features/Split/notesSplitLayout';
import type { NotesSplitDropTarget } from './notesViewSplitTypes';

export function useNotesSplitDrop(args: {
  active: boolean;
  currentNotePathRef: MutableRefObject<string | null>;
  nextSplitPaneId: (prefix: 'preview' | 'split') => string;
  openNote: ReturnType<typeof useNotesStore.getState>['openNote'];
  openNoteByAbsolutePath: ReturnType<typeof useNotesStore.getState>['openNoteByAbsolutePath'];
  openTabs: ReturnType<typeof useNotesStore.getState>['openTabs'];
  prefetchNote: ReturnType<typeof useNotesStore.getState>['prefetchNote'];
  setSplitDropTarget: Dispatch<SetStateAction<NotesSplitDropTarget | null>>;
  setSplitPaneTree: Dispatch<SetStateAction<NotesSplitPaneTree>>;
  splitDropRootRef: MutableRefObject<HTMLDivElement | null>;
}) {
  const {
    active,
    currentNotePathRef,
    nextSplitPaneId,
    openNote,
    openNoteByAbsolutePath,
    openTabs,
    prefetchNote,
    setSplitDropTarget,
    setSplitPaneTree,
    splitDropRootRef,
  } = args;

  const resolveSplitDropTarget = useCallback((detail: {
    path: string;
    clientX?: number;
    clientY?: number;
    sourceLeafId?: string;
  }): NotesSplitDropTarget | null => {
    if (!active || detail.clientX === undefined || detail.clientY === undefined) {
      return null;
    }

    const dropRoot = splitDropRootRef.current;
    if (!dropRoot) {
      return null;
    }

    const point = { clientX: detail.clientX, clientY: detail.clientY };
    const elements = typeof document.elementsFromPoint === 'function'
      ? document.elementsFromPoint(point.clientX, point.clientY)
      : [];
    const leafElement = elements
      .map((element) => element instanceof HTMLElement
        ? element.closest<HTMLElement>('[data-notes-split-leaf-id]')
        : null)
      .find((element) => Boolean(
        element &&
        dropRoot.contains(element) &&
        element.dataset.notesSplitLeafId !== detail.sourceLeafId
      ));
    const fallbackLeafElement = Array.from(dropRoot.querySelectorAll<HTMLElement>('[data-notes-split-leaf-id]'))
      .find((element) => element.dataset.notesSplitLeafId !== detail.sourceLeafId);
    const targetElement = leafElement ?? fallbackLeafElement;
    if (!targetElement) {
      return null;
    }

    const direction = resolveNotesSplitDropDirection(targetElement.getBoundingClientRect(), point)
      ?? (leafElement ? null : resolveNotesSplitDropDirection(dropRoot.getBoundingClientRect(), point));
    if (!direction) {
      return null;
    }

    return {
      leafId: targetElement.dataset.notesSplitLeafId ?? '',
      direction,
    };
  }, [active, splitDropRootRef]);

  const openSplitPane = useCallback((path: string, target: NotesSplitDropTarget, source: NotesSplitDragSource = 'tab') => {
    const insertPreview = () => {
      const previewLeaf: NotesSplitPreviewLeaf = {
        type: 'preview',
        id: nextSplitPaneId('preview'),
        path,
        requiresOpenTab: source !== 'sidebar',
      };
      setSplitPaneTree((currentTree) => splitNotesPaneTree(
        currentTree,
        target.leafId,
        previewLeaf,
        target.direction,
        nextSplitPaneId('split'),
      ));
    };

    const currentPath = currentNotePathRef.current;
    if (path === currentPath) {
      const fallbackTab = openTabs.find((tab) => tab.path !== path);
      if (fallbackTab) {
        void Promise.resolve(openStoredNotePath(fallbackTab.path, {
          openNote,
          openNoteByAbsolutePath,
        })).then(() => {
          insertPreview();
        });
        return;
      }
    }

    if (source === 'sidebar' && path !== currentPath) {
      void prefetchNote(path).finally(insertPreview);
      return;
    }

    insertPreview();
  }, [currentNotePathRef, nextSplitPaneId, openNote, openNoteByAbsolutePath, openTabs, prefetchNote, setSplitPaneTree]);

  useEffect(() => {
    if (!active) {
      setSplitDropTarget(null);
      return;
    }

    return subscribeNotesTabSplitDrag((detail) => {
      if (detail.phase === 'move') {
        setSplitDropTarget(resolveSplitDropTarget(detail));
        return;
      }

      if (detail.phase === 'end') {
        const target = resolveSplitDropTarget(detail);
        setSplitDropTarget(null);
        if (target) {
          openSplitPane(detail.path, target, detail.source);
          return true;
        }
        return false;
      }

      setSplitDropTarget(null);
      return false;
    });
  }, [active, openSplitPane, resolveSplitDropTarget, setSplitDropTarget]);

  useEffect(() => {
    const openTabPaths = new Set(openTabs.map((tab) => tab.path));
    setSplitPaneTree((currentTree) => (
      pruneNotesSplitPaneTree(currentTree, (leaf) => (
        leaf.requiresOpenTab && !openTabPaths.has(leaf.path)
      )) ?? createInitialNotesSplitPaneTree()
    ));
  }, [openTabs, setSplitPaneTree]);

  return { resolveSplitDropTarget };
}
