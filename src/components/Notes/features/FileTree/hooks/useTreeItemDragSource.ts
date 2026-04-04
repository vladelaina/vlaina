import { useCallback } from 'react';
import type React from 'react';
import type { NotesSidebarRowDragHandlers } from '../../Sidebar/NotesSidebarRow';

export function useTreeItemDragSource(path: string, disabled = false): NotesSidebarRowDragHandlers {
  const handleDragStart = useCallback(
    (event: React.DragEvent) => {
      event.dataTransfer.setData('text/plain', path);
      event.dataTransfer.effectAllowed = 'move';
    },
    [path],
  );

  return {
    draggable: !disabled,
    onDragStart: handleDragStart,
  };
}
