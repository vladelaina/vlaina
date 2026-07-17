import { useEffect, useRef, type RefObject } from 'react';
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
  const sizedNotesRootRef = useRef<string | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (isLoading || !displayRootFolder) {
      sizedNotesRootRef.current = null;
      return;
    }
    if (!active || !root) return;

    const notesRootKey = notesPath || notesRootPath || displayRootFolder.path || displayRootFolder.id;
    if (sizedNotesRootRef.current === notesRootKey) return;
    sizedNotesRootRef.current = notesRootKey;

    const applyInitialWidth = () => {
      if (sizedNotesRootRef.current !== notesRootKey || !root.isConnected) return;

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
    };

    const fontsReady = document.fonts?.ready;
    if (fontsReady) {
      void fontsReady.then(applyInitialWidth);
    } else {
      applyInitialWidth();
    }

  }, [active, displayRootFolder, isLoading, notesPath, notesRootPath, rootRef, setSidebarWidth]);
}
