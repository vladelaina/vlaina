import { useEffect, type RefObject } from 'react';
import { setAutoSizedSidebarDefaultWidth } from '@/lib/layout/sidebarWidth';
import { useUIStore } from '@/stores/uiSlice';
import type { FolderNode } from '@/stores/useNotesStore';
import { getRecommendedFileTreeSidebarWidth } from '../FileTree/virtualFileTree';

export function useNotesSidebarAutoWidth(args: {
  active: boolean;
  displayRootFolder: FolderNode | null;
  isLoading: boolean;
  notesPath: string;
  notesRootPath: string | null;
  rootRef: RefObject<HTMLDivElement | null>;
  setSidebarWidth: (width: number) => void;
}) {
  const {
    active,
    displayRootFolder,
    isLoading,
    notesPath,
    notesRootPath,
    rootRef,
    setSidebarWidth,
  } = args;

  useEffect(() => {
    const root = rootRef.current;
    if (!active || isLoading || !displayRootFolder || !root) return;

    let measureTextWidth: ((value: string) => number) | undefined;
    if (typeof OffscreenCanvas !== 'undefined') {
      const context = new OffscreenCanvas(1, 1).getContext('2d');
      if (context) {
        const style = getComputedStyle(root);
        context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        measureTextWidth = (value) => context.measureText(value).width;
      }
    }

    const recommendedWidth = getRecommendedFileTreeSidebarWidth(
      displayRootFolder.children,
      measureTextWidth,
    );
    setAutoSizedSidebarDefaultWidth(recommendedWidth);
    if (recommendedWidth > useUIStore.getState().sidebarWidth) {
      setSidebarWidth(recommendedWidth);
    }
  }, [active, displayRootFolder, isLoading, notesPath, notesRootPath, rootRef, setSidebarWidth]);
}
