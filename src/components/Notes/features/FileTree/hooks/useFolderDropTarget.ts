import { useCallback, useState } from 'react';
import type React from 'react';
import { useNotesStore } from '@/stores/useNotesStore';
import { isInvalidMoveTarget } from '@/stores/notes/utils/fs/moveValidation';

export function useFolderDropTarget(path: string) {
  const moveItem = useNotesStore((state) => state.moveItem);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    async (event: React.DragEvent) => {
      event.preventDefault();
      setIsDragOver(false);

      const sourcePath = event.dataTransfer.getData('text/plain');
      if (!sourcePath || isInvalidMoveTarget(sourcePath, path)) {
        return;
      }

      await moveItem(sourcePath, path);
    },
    [moveItem, path],
  );

  return {
    isDragOver,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  };
}
