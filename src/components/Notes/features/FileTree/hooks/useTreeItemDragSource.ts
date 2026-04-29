import { useCallback } from 'react';
import type React from 'react';
import type { NotesSidebarRowDragHandlers } from '../../Sidebar/NotesSidebarRow';
import { startFileTreePointerDrag, useFileTreePointerDragState } from './fileTreePointerDragState';

export function useTreeItemDragSource(
  path: string,
  disabled = false,
  kind: 'note' | 'folder' = 'note',
): NotesSidebarRowDragHandlers {
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

      startFileTreePointerDrag(path, kind, event.currentTarget, event.nativeEvent);
    },
    [disabled, kind, path],
  );

  return {
    onPointerDown: handlePointerDown,
    isDragging,
  };
}
