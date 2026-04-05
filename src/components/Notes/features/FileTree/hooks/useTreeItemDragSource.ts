import { useCallback } from 'react';
import type React from 'react';
import type { NotesSidebarRowDragHandlers } from '../../Sidebar/NotesSidebarRow';
import { startFileTreePointerDrag, useFileTreePointerDragState } from './fileTreePointerDragState';

export function useTreeItemDragSource(path: string, disabled = false): NotesSidebarRowDragHandlers {
  const isDragging = useFileTreePointerDragState((state) => state.activeSourcePath === path);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (disabled || event.button !== 0 || event.pointerType === 'touch') {
        return;
      }

      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.closest('button, input, textarea, select, a, [contenteditable="true"], [data-slot="dialog-close"]')
      ) {
        return;
      }

      startFileTreePointerDrag(path, event.currentTarget, event.nativeEvent);
    },
    [disabled, path],
  );

  return {
    onPointerDown: handlePointerDown,
    isDragging,
  };
}
